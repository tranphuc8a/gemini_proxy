"""SQL persistence of course content (MySQL in production, SQLite in tests and dev).

The one rule this file is built around: **never load `md` or `body_folded`
unless the caller asked for markdown.** The AI course alone is 6 MB of markdown
and another 6 MB folded; every listing, the manifest and the structure editor
select columns explicitly so that cost is only paid when a document is opened,
or once per process for the search index.

Writes keep three things in step that the browser relies on:

* the derived columns of a document (outline, counts, folded text) — the ORM
  event in `course_entity.py` for single rows, `derived_doc_values` for the
  bulk importer;
* `courses.stats` — recomputed from the documents after every change;
* `courses.version` — bumped after every change, by the database itself
  (``version = version + 1``) so two overlapping saves cannot both write N+1.
  Caches are keyed on the *revision* — row id, creation time and version —
  because a course deleted and imported again restarts at version 1.

Every write starts by locking the course row (``SELECT … FOR UPDATE``), so two
admins saving the same course queue instead of interleaving, and the statistics
are read with a locking read, which sees the latest committed documents rather
than the snapshot the transaction started with. SQLite ignores both clauses; it
serialises writers on its own.

Remote MySQL makes every statement a network round trip, so bulk changes are
few statements, not one per row: documents go in as multi-row INSERTs, a new
navigation tree is written section-by-section in two INSERTs, and documents are
re-attached to it by chunked ``UPDATE … SET group_id = CASE doc_id …``. Child
rows are deleted with Core statements in dependency order instead of ORM
cascades: a cascade would load every document first, markdown included, and
SQLite — the test and dev engine — does not enforce foreign keys anyway.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import case, delete, func, insert, literal, select, union_all, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapter.output.mysql.entities.course_entity import (
    CourseDocEntity,
    CourseEntity,
    CourseGroupEntity,
    CourseSectionEntity,
    derived_doc_values,
)
from src.application.ports.output.course_output_port import CourseOutputPort
from src.domain.models.course_domain import (
    CourseBundle,
    CourseDocDomain,
    CourseDomain,
    CourseGroupDomain,
    CourseSectionDomain,
)

#: Text per multi-row INSERT of documents (markdown + its folded copy, counted
#: as UTF-8). The AI course (12 MB with the folded copy) goes in a few
#: statements, each far below MySQL's max_allowed_packet (64 MB by default).
_INSERT_CHUNK_BYTES = 4 * 1024 * 1024

#: Documents per ``UPDATE … CASE`` when a structure is re-attached. aiomysql runs
#: an executemany UPDATE as one statement per row; this is one per chunk. Five
#: bind parameters per document keep a chunk under SQLite's old 999 limit.
_UPDATE_CHUNK = 150

#: `sort_order` of documents the tree does not list: they sort after every
#: listed one, in their previous relative order.
_UNLISTED_BASE = 100000

#: Stats keys recomputed from the documents. Anything else in `courses.stats`
#: (e.g. "lessonsPlanned", "subjects" of the AI course) is editorial and kept.
_COMPUTED_STATS = ("files", "words", "minutes", "lessons")

#: Columns of a document summary — everything except the heavy text columns.
_SUMMARY_COLUMNS = (
    CourseDocEntity.doc_id,
    CourseDocEntity.slug,
    CourseDocEntity.title,
    CourseDocEntity.kind,
    CourseDocEntity.tag,
    CourseDocEntity.meta_json.label("meta"),
    CourseDocEntity.words,
    CourseDocEntity.code_lines,
    CourseDocEntity.minutes,
    CourseDocEntity.sort_order,
    CourseDocEntity.updated_at,
    CourseDocEntity.group_id,
)

_DOCS = CourseDocEntity.__table__
_SECTIONS = CourseSectionEntity.__table__
_GROUPS = CourseGroupEntity.__table__


def _now() -> int:
    return int(time.time())


def revision_of(course_id: int, created_at: Optional[int], version: Optional[int]) -> str:
    """The cache key of a course's content. The version alone is not enough: it
    restarts at 1 when a course is deleted and imported again."""
    return f"{int(course_id)}.{int(created_at or 0)}.{int(version or 0)}"


def _course_to_domain(ent: CourseEntity, doc_count: int = 0) -> CourseDomain:
    return CourseDomain(
        slug=ent.slug,
        title=ent.title,
        subtitle=ent.subtitle or "",
        description=ent.description or "",
        icon=ent.icon or "",
        config=dict(ent.config or {}),
        stats=dict(ent.stats or {}),
        published=bool(ent.published),
        version=int(ent.version or 1),
        revision=revision_of(ent.id, ent.created_at, ent.version),
        created_at=int(ent.created_at or 0),
        updated_at=int(ent.updated_at or 0),
        doc_count=doc_count,
    )


def _summary_to_domain(r: Any, where: Dict[int, Tuple[str, str]]) -> CourseDocDomain:
    sec, grp = where.get(r.group_id, ("", ""))
    return CourseDocDomain(
        id=r.doc_id, slug=r.slug, title=r.title, kind=r.kind, tag=r.tag, section=sec, group=grp,
        meta=dict(r.meta or {}), words=r.words, code_lines=r.code_lines, minutes=r.minutes,
        updated_at=int(r.updated_at or 0),
    )


def _full_to_domain(r: CourseDocEntity, section: str, group: str) -> CourseDocDomain:
    return CourseDocDomain(
        id=r.doc_id, slug=r.slug, title=r.title, kind=r.kind, tag=r.tag, section=section, group=group,
        meta=dict(r.meta_json or {}), outline=list(r.outline or []), words=r.words, code_lines=r.code_lines,
        minutes=r.minutes, md=r.md or "", updated_at=int(r.updated_at or 0),
    )


def _chunks(items: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


class CourseRepository(CourseOutputPort):
    def __init__(self, db: AsyncSession):
        self.db = db

    # ================================================================ helpers

    async def _course_id(self, slug: str) -> Optional[int]:
        res = await self.db.execute(select(CourseEntity.id).where(CourseEntity.slug == slug))
        return res.scalar_one_or_none()

    async def _lock(self, *, slug: Optional[str] = None, course_id: Optional[int] = None) -> Optional[CourseEntity]:
        """The course row, locked until this transaction ends.

        `populate_existing` because a locking read returns the latest committed
        row, and that — not an older copy in the identity map — is what the
        stats merge and the version bump must start from.
        """
        cond = CourseEntity.slug == slug if slug is not None else CourseEntity.id == course_id
        res = await self.db.execute(
            select(CourseEntity).where(cond).with_for_update().execution_options(populate_existing=True)
        )
        return res.scalar_one_or_none()

    async def _tree(self, course_id: int, placed: Optional[Iterable[Any]] = None
                    ) -> Tuple[List[CourseSectionDomain], Dict[int, Tuple[str, str]], Dict[str, int]]:
        """The navigation tree; group row id → (section id, group label); doc id → rank.

        `placed` is any sequence of rows with `doc_id` and `group_id`, ordered by
        (sort_order, id) — the documents a caller has loaded anyway. Without it
        one light query fetches just those two columns. Relationship loading is
        avoided on purpose: `CourseGroupEntity.docs` would pull whole rows.
        """
        sec_rows = (await self.db.execute(
            select(_SECTIONS.c.id, _SECTIONS.c.sec_id, _SECTIONS.c.title, _SECTIONS.c.sub, _SECTIONS.c.icon)
            .where(_SECTIONS.c.course_id == course_id)
            .order_by(_SECTIONS.c.sort_order, _SECTIONS.c.id)
        )).all()
        grp_rows = []
        if sec_rows:
            grp_rows = (await self.db.execute(
                select(_GROUPS.c.id, _GROUPS.c.section_id, _GROUPS.c.title, _GROUPS.c.short, _GROUPS.c.meta)
                .join(_SECTIONS, _SECTIONS.c.id == _GROUPS.c.section_id)
                .where(_SECTIONS.c.course_id == course_id)
                .order_by(_GROUPS.c.sort_order, _GROUPS.c.id)
            )).all()
        if placed is None:
            placed = (await self.db.execute(
                select(_DOCS.c.doc_id, _DOCS.c.group_id)
                .where(_DOCS.c.course_id == course_id, _DOCS.c.group_id.is_not(None))
                .order_by(_DOCS.c.sort_order, _DOCS.c.id)
            )).all()

        items: Dict[int, List[str]] = {}
        for r in placed:
            if r.group_id is not None:
                items.setdefault(r.group_id, []).append(r.doc_id)

        sections: Dict[int, CourseSectionDomain] = {}
        for r in sec_rows:
            sections[r.id] = CourseSectionDomain(id=r.sec_id, title=r.title, sub=r.sub or "", icon=r.icon or "")
        where: Dict[int, Tuple[str, str]] = {}
        for g in grp_rows:
            sec = sections[g.section_id]
            sec.groups.append(CourseGroupDomain(title=g.title, short=g.short or "", meta=dict(g.meta or {}),
                                                items=items.get(g.id, [])))
            where[g.id] = (sec.id, g.short or g.title)
        ordered_sections = [sections[r.id] for r in sec_rows]
        rank: Dict[str, int] = {}
        for sec in ordered_sections:
            for grp in sec.groups:
                for doc_id in grp.items:
                    rank.setdefault(doc_id, len(rank))
        return ordered_sections, where, rank

    @staticmethod
    def _sorted(rows: Sequence[Any], rank: Dict[str, int], key=lambda r: r.doc_id) -> List[Any]:
        """Navigation order: section, then group, then position in the group.

        `sort_order` alone is a position *within a group*, so ordering by it
        would interleave the groups. Documents the tree does not list go last,
        in their own order (`sorted` is stable and the rows come sorted).
        """
        big = len(rank) + 1
        return sorted(rows, key=lambda r: rank.get(key(r), big))

    async def _summary_rows(self, course_id: int) -> List[Any]:
        return (await self.db.execute(
            select(*_SUMMARY_COLUMNS).where(CourseDocEntity.course_id == course_id)
            .order_by(CourseDocEntity.sort_order, CourseDocEntity.id)
        )).all()

    async def _refresh_course(self, course: CourseEntity, extra_stats: Optional[Dict[str, Any]] = None) -> None:
        """Recompute stats from the documents and bump the version.

        `course` must come from `_lock`. The aggregate is a locking read: under
        MySQL's REPEATABLE READ a plain SELECT would answer from this
        transaction's snapshot, which may predate a save that committed while
        we waited for the lock.
        """
        agg = (await self.db.execute(
            select(func.count(), func.coalesce(func.sum(_DOCS.c.words), 0), func.coalesce(func.sum(_DOCS.c.minutes), 0),
                   func.coalesce(func.sum(case((_DOCS.c.kind == "lesson", 1), else_=0)), 0))
            .where(_DOCS.c.course_id == course.id)
            .with_for_update(read=True)
        )).one()
        stats = {k: v for k, v in dict(course.stats or {}).items() if k not in _COMPUTED_STATS}
        if extra_stats:
            stats.update({k: v for k, v in extra_stats.items() if k not in _COMPUTED_STATS})
        stats.update({"files": int(agg[0]), "words": int(agg[1]), "minutes": int(agg[2]), "lessons": int(agg[3])})
        course.stats = stats
        course.updated_at = _now()
        # Evaluated by the database: `SET version = version + 1`.
        course.version = CourseEntity.version + 1
        await self.db.flush()
        # The attribute is expired by the flush; load it explicitly (no lazy IO in asyncio).
        await self.db.refresh(course, attribute_names=["version"])

    async def touch_course(self, course_id: int) -> None:
        """Public hook for write paths outside this class (the sqladmin views)."""
        course = await self._lock(course_id=course_id)
        if course is None:
            await self.db.rollback()
            return
        await self._refresh_course(course)
        await self.db.commit()

    async def _clear_structure(self, course_id: int) -> None:
        await self.db.execute(update(_DOCS).where(_DOCS.c.course_id == course_id).values(group_id=None))
        sec_ids = select(_SECTIONS.c.id).where(_SECTIONS.c.course_id == course_id)
        await self.db.execute(delete(_GROUPS).where(_GROUPS.c.section_id.in_(sec_ids)))
        await self.db.execute(delete(_SECTIONS).where(_SECTIONS.c.course_id == course_id))

    async def _insert_structure(self, course_id: int, sections: Sequence[CourseSectionDomain]) -> Dict[str, Tuple[int, int]]:
        """Insert sections and groups; return doc id → (group row id, position).

        Two multi-row INSERTs and two SELECTs whatever the size of the tree:
        MySQL has no RETURNING, so the new ids are read back by their natural
        keys — (course, section id) and (section row, group position).
        """
        if not sections:
            return {}
        await self.db.execute(insert(_SECTIONS), [
            {"course_id": course_id, "sec_id": sec.id, "title": sec.title, "sub": sec.sub or "",
             "icon": sec.icon or "", "sort_order": s_pos}
            for s_pos, sec in enumerate(sections)
        ])
        sec_row_ids = {r.sec_id: r.id for r in (await self.db.execute(
            select(_SECTIONS.c.id, _SECTIONS.c.sec_id).where(_SECTIONS.c.course_id == course_id)
        )).all()}

        group_values = [
            {"section_id": sec_row_ids[sec.id], "title": grp.title, "short": grp.short or "",
             "meta": dict(grp.meta or {}), "sort_order": g_pos}
            for sec in sections for g_pos, grp in enumerate(sec.groups)
        ]
        group_row_ids: Dict[Tuple[int, int], int] = {}
        if group_values:
            await self.db.execute(insert(_GROUPS), group_values)
            group_row_ids = {(r.section_id, r.sort_order): r.id for r in (await self.db.execute(
                select(_GROUPS.c.id, _GROUPS.c.section_id, _GROUPS.c.sort_order)
                .where(_GROUPS.c.section_id.in_(list(sec_row_ids.values())))
            )).all()}

        placement: Dict[str, Tuple[int, int]] = {}
        for sec in sections:
            for g_pos, grp in enumerate(sec.groups):
                group_id = group_row_ids[(sec_row_ids[sec.id], g_pos)]
                for i_pos, doc_id in enumerate(grp.items):
                    # A document listed twice keeps its first place: one row, one group.
                    placement.setdefault(doc_id, (group_id, i_pos))
        return placement

    # ================================================================ reading

    async def list_courses(self, include_unpublished: bool) -> List[CourseDomain]:
        stmt = select(CourseEntity).order_by(CourseEntity.title)
        if not include_unpublished:
            stmt = stmt.where(CourseEntity.published.is_(True))
        rows = (await self.db.execute(stmt)).scalars().all()
        ids = [r.id for r in rows]
        counts: Dict[int, int] = {}
        if ids:
            counts = {r[0]: int(r[1]) for r in (await self.db.execute(
                select(_DOCS.c.course_id, func.count()).where(_DOCS.c.course_id.in_(ids)).group_by(_DOCS.c.course_id)
            )).all()}
        return [_course_to_domain(r, counts.get(r.id, 0)) for r in rows]

    async def _course_with_count(self, slug: str) -> Optional[Tuple[CourseEntity, int]]:
        doc_count = select(func.count()).where(_DOCS.c.course_id == CourseEntity.id).scalar_subquery()
        row = (await self.db.execute(
            select(CourseEntity, doc_count).where(CourseEntity.slug == slug)
            .execution_options(populate_existing=True)
        )).one_or_none()
        return (row[0], int(row[1] or 0)) if row else None

    async def get_course(self, slug: str) -> Optional[CourseDomain]:
        found = await self._course_with_count(slug)
        if found is None:
            return None
        course = _course_to_domain(*found)
        course.sections, _, _ = await self._tree(found[0].id)
        return course

    async def course_state(self, slug: str) -> Optional[Tuple[str, bool]]:
        row = (await self.db.execute(
            select(CourseEntity.id, CourseEntity.created_at, CourseEntity.version, CourseEntity.published)
            .where(CourseEntity.slug == slug)
        )).one_or_none()
        return (revision_of(row.id, row.created_at, row.version), bool(row.published)) if row else None

    async def get_manifest(self, slug: str) -> Optional[Tuple[CourseDomain, List[CourseDocDomain]]]:
        """Course, tree and document summaries in four queries — the tree's
        placements come from the summaries instead of a query of their own."""
        row = (await self.db.execute(
            select(CourseEntity).where(CourseEntity.slug == slug).execution_options(populate_existing=True)
        )).scalar_one_or_none()
        if row is None:
            return None
        rows = await self._summary_rows(row.id)
        sections, where, rank = await self._tree(row.id, placed=rows)
        course = _course_to_domain(row, len(rows))
        course.sections = sections
        return course, [_summary_to_domain(r, where) for r in self._sorted(rows, rank)]

    async def list_doc_summaries(self, slug: str) -> List[CourseDocDomain]:
        found = await self.get_manifest(slug)
        return [] if found is None else found[1]

    async def get_doc(self, slug: str, doc_id: str) -> Optional[CourseDocDomain]:
        """One document with the labels of its section and group, in one query."""
        row = (await self.db.execute(
            select(CourseDocEntity, _SECTIONS.c.sec_id, _GROUPS.c.short, _GROUPS.c.title.label("group_title"))
            .join(CourseEntity, CourseEntity.id == CourseDocEntity.course_id)
            .outerjoin(_GROUPS, _GROUPS.c.id == CourseDocEntity.group_id)
            .outerjoin(_SECTIONS, _SECTIONS.c.id == _GROUPS.c.section_id)
            .where(CourseEntity.slug == slug, CourseDocEntity.doc_id == doc_id)
            .execution_options(populate_existing=True)
        )).one_or_none()
        if row is None:
            return None
        doc, sec_id, short, group_title = row
        return _full_to_domain(doc, sec_id or "", (short or group_title or "") if sec_id else "")

    async def list_docs_full(self, slug: str) -> List[CourseDocDomain]:
        course_id = await self._course_id(slug)
        if course_id is None:
            return []
        rows = (await self.db.execute(
            select(CourseDocEntity).where(CourseDocEntity.course_id == course_id)
            .order_by(CourseDocEntity.sort_order, CourseDocEntity.id)
        )).scalars().all()
        _, where, rank = await self._tree(course_id, placed=rows)
        out = []
        for r in self._sorted(rows, rank):
            sec, grp = where.get(r.group_id, ("", ""))
            out.append(_full_to_domain(r, sec, grp))
        return out

    async def markdown_size(self, slug: str) -> int:
        course_id = await self._course_id(slug)
        if course_id is None:
            return 0
        return int((await self.db.execute(
            select(func.coalesce(func.sum(func.length(_DOCS.c.md)), 0)).where(_DOCS.c.course_id == course_id)
        )).scalar_one())

    async def search_rows(self, slug: str) -> List[Dict[str, Any]]:
        """Everything the ranker needs, folded — and no markdown."""
        course_id = await self._course_id(slug)
        if course_id is None:
            return []
        rows = (await self.db.execute(
            select(_DOCS.c.doc_id, _DOCS.c.slug, _DOCS.c.title, _DOCS.c.kind, _DOCS.c.group_id, _DOCS.c.outline,
                   _DOCS.c.title_folded, _DOCS.c.heads_folded, _DOCS.c.body_folded)
            .where(_DOCS.c.course_id == course_id)
            .order_by(_DOCS.c.sort_order, _DOCS.c.id)
        )).all()
        _, where, rank = await self._tree(course_id, placed=rows)
        return [{
            "id": r.doc_id, "slug": r.slug, "title": r.title, "kind": r.kind,
            "group": where.get(r.group_id, ("", ""))[1], "outline": list(r.outline or []),
            "title_f": r.title_folded or "", "heads_f": r.heads_folded or "", "body_f": r.body_folded or "",
        } for r in self._sorted(rows, rank)]

    async def excerpts(self, slug: str, spans: Sequence[Tuple[str, int, int]]) -> Dict[str, str]:
        """doc_id → md[start:start+length], cut by the database in ONE round trip.

        Positions are code points in Python; SUBSTR counts characters in both
        MySQL (utf8mb4) and SQLite, so they agree.
        """
        course_id = await self._course_id(slug)
        if course_id is None or not spans:
            return {}
        parts = [
            select(literal(doc_id).label("doc_id"),
                   func.substr(_DOCS.c.md, max(1, start + 1), length).label("piece"))
            .where(_DOCS.c.course_id == course_id, _DOCS.c.doc_id == doc_id)
            for doc_id, start, length in spans
        ]
        stmt = parts[0] if len(parts) == 1 else union_all(*parts)
        return {r.doc_id: r.piece or "" for r in (await self.db.execute(stmt)).all()}

    async def slug_taken(self, slug: str, doc_slug: str, except_doc: Optional[str] = None) -> bool:
        course_id = await self._course_id(slug)
        if course_id is None:
            return False
        stmt = select(_DOCS.c.doc_id).where(_DOCS.c.course_id == course_id, _DOCS.c.slug == doc_slug)
        if except_doc is not None:
            stmt = stmt.where(_DOCS.c.doc_id != except_doc)
        return (await self.db.execute(stmt.limit(1))).scalar_one_or_none() is not None

    # ================================================================ writing

    async def _insert_docs(self, course_id: int, bundle: CourseBundle, placement: Dict[str, Tuple[int, int]]) -> None:
        """Every document of a bundle as multi-row INSERTs of about 4 MB.

        A Core INSERT bypasses the ORM event, so the derived columns are
        computed here by the same function the event uses.
        """
        # Documents in navigation order first, then any the tree does not list.
        ordered = list(dict.fromkeys(d for d in bundle.order if d in bundle.docs))
        listed = set(ordered)
        ordered += [d for d in bundle.docs if d not in listed]
        unlisted = 0
        batch: List[Dict[str, Any]] = []
        size = 0
        for doc_id in ordered:
            doc = bundle.docs[doc_id]
            group_id, position = placement.get(doc_id, (None, None))
            if group_id is None:
                position = _UNLISTED_BASE + unlisted
                unlisted += 1
            md = doc.md or ""
            values = {
                "course_id": course_id, "group_id": group_id, "doc_id": doc_id, "slug": doc.slug,
                "title": doc.title, "kind": doc.kind or "lesson", "tag": doc.tag, "meta": dict(doc.meta or {}),
                "md": md, "sort_order": position,
            }
            values.update(derived_doc_values(md, doc.title))
            batch.append(values)
            size += 2 * len(md.encode("utf-8")) + 1024
            if size >= _INSERT_CHUNK_BYTES:
                await self.db.execute(insert(_DOCS), batch)
                batch, size = [], 0
        if batch:
            await self.db.execute(insert(_DOCS), batch)

    async def replace_course(self, course: CourseDomain, bundle: CourseBundle) -> CourseDomain:
        row = await self._lock(slug=course.slug)
        now = _now()
        if row is None:
            row = CourseEntity(slug=course.slug, title=course.title, created_at=now, updated_at=now,
                               version=0, stats={}, config={})
            self.db.add(row)
            await self.db.flush()
        else:
            await self.db.execute(delete(_DOCS).where(_DOCS.c.course_id == row.id))
            await self._clear_structure(row.id)
        row.title = course.title
        row.subtitle = course.subtitle or ""
        row.description = course.description or ""
        row.icon = course.icon or ""
        row.config = dict(course.config or {})
        row.published = bool(course.published)
        row.stats = {}

        placement = await self._insert_structure(row.id, bundle.nav)
        await self._insert_docs(row.id, bundle, placement)
        await self._refresh_course(row, extra_stats=bundle.stats)
        await self.db.commit()
        return await self.get_course(course.slug)  # type: ignore[return-value]

    async def update_course(self, slug: str, fields: Dict[str, Any]) -> Optional[CourseDomain]:
        row = await self._lock(slug=slug)
        if row is None:
            await self.db.rollback()
            return None
        for key in ("title", "subtitle", "description", "icon", "config", "published"):
            if key in fields and fields[key] is not None:
                setattr(row, key, fields[key])
        await self._refresh_course(row, extra_stats=fields.get("stats"))
        await self.db.commit()
        return await self.get_course(slug)

    async def create_course(self, course: CourseDomain) -> CourseDomain:
        now = _now()
        self.db.add(CourseEntity(
            slug=course.slug, title=course.title, subtitle=course.subtitle or "", description=course.description or "",
            icon=course.icon or "", config=dict(course.config or {}), stats={}, published=bool(course.published),
            version=1, created_at=now, updated_at=now,
        ))
        await self.db.commit()
        return await self.get_course(course.slug)  # type: ignore[return-value]

    async def delete_course(self, slug: str) -> bool:
        row = await self._lock(slug=slug)
        if row is None:
            await self.db.rollback()
            return False
        course_id = row.id
        await self.db.execute(delete(_DOCS).where(_DOCS.c.course_id == course_id))
        await self._clear_structure(course_id)
        await self.db.execute(delete(CourseEntity.__table__).where(CourseEntity.__table__.c.id == course_id))
        await self.db.commit()
        self.db.expunge_all()
        return True

    async def replace_structure(self, slug: str, sections: List[CourseSectionDomain]) -> Optional[CourseDomain]:
        course = await self._lock(slug=slug)
        if course is None:
            await self.db.rollback()
            return None
        await self._clear_structure(course.id)
        placement = await self._insert_structure(course.id, sections)
        placed = list(placement.items())
        for chunk in _chunks(placed, _UPDATE_CHUNK):
            await self.db.execute(
                update(_DOCS)
                .where(_DOCS.c.course_id == course.id, _DOCS.c.doc_id.in_([doc_id for doc_id, _ in chunk]))
                .values(group_id=case({doc_id: g for doc_id, (g, _) in chunk}, value=_DOCS.c.doc_id),
                        sort_order=case({doc_id: p for doc_id, (_, p) in chunk}, value=_DOCS.c.doc_id))
            )
        # Documents the new tree no longer lists drop to the end, in their old
        # order. Already-unlisted ones keep their number, so it cannot grow
        # with every save.
        await self.db.execute(
            update(_DOCS)
            .where(_DOCS.c.course_id == course.id, _DOCS.c.group_id.is_(None), _DOCS.c.sort_order < _UNLISTED_BASE)
            .values(sort_order=_DOCS.c.sort_order + _UNLISTED_BASE)
        )
        await self._refresh_course(course)
        await self.db.commit()
        return await self.get_course(slug)

    async def _group_row_id(self, course_id: int, section: str, group: str) -> Optional[int]:
        return (await self.db.execute(
            select(_GROUPS.c.id)
            .join(_SECTIONS, _SECTIONS.c.id == _GROUPS.c.section_id)
            .where(_SECTIONS.c.course_id == course_id, _SECTIONS.c.sec_id == section,
                   (_GROUPS.c.short == group) | (_GROUPS.c.title == group))
            .order_by(_GROUPS.c.sort_order)
            .limit(1)
        )).scalar_one_or_none()

    async def upsert_doc(self, slug: str, doc: CourseDocDomain, group_ref: Optional[Dict[str, str]]) -> Optional[CourseDocDomain]:
        course = await self._lock(slug=slug)
        if course is None:
            await self.db.rollback()
            return None
        row = (await self.db.execute(
            select(CourseDocEntity).where(CourseDocEntity.course_id == course.id, CourseDocEntity.doc_id == doc.id)
        )).scalar_one_or_none()
        if row is None:
            row = CourseDocEntity(course_id=course.id, doc_id=doc.id, slug=doc.slug, title=doc.title,
                                  kind=doc.kind, tag=doc.tag, meta_json=dict(doc.meta or {}), md=doc.md or "")
            self.db.add(row)
        else:
            row.slug, row.title, row.kind, row.tag = doc.slug, doc.title, doc.kind, doc.tag
            row.meta_json = dict(doc.meta or {})
            row.md = doc.md or ""
            # The derived columns depend on md and title only; force the event to
            # run even when SQLAlchemy sees no change in other attributes.
            row.updated_at = _now()
        if group_ref:
            group_id = await self._group_row_id(course.id, group_ref.get("section", ""), group_ref.get("group", ""))
            if group_id is None:
                await self.db.rollback()
                raise LookupError(f"group {group_ref.get('group')!r} not found in section {group_ref.get('section')!r}")
            if row.group_id != group_id:
                last = (await self.db.execute(
                    select(func.coalesce(func.max(_DOCS.c.sort_order), -1))
                    .where(_DOCS.c.course_id == course.id, _DOCS.c.group_id == group_id)
                )).scalar_one()
                row.group_id = group_id
                row.sort_order = int(last) + 1
        elif row.sort_order is None:
            row.sort_order = 2 * _UNLISTED_BASE
        await self.db.flush()
        await self._refresh_course(course)
        await self.db.commit()
        return await self.get_doc(slug, doc.id)

    async def delete_doc(self, slug: str, doc_id: str) -> bool:
        course = await self._lock(slug=slug)
        if course is None:
            await self.db.rollback()
            return False
        res = await self.db.execute(delete(_DOCS).where(_DOCS.c.course_id == course.id, _DOCS.c.doc_id == doc_id))
        if not res.rowcount:
            await self.db.rollback()
            return False
        await self._refresh_course(course)
        await self.db.commit()
        return True
