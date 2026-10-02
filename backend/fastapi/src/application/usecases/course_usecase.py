"""Course content use cases: what the course pages read, and what an admin changes.

The web engine used to receive a whole course as one `content.js` — 8 MB for the
AI course — and index it in the browser. It now asks for three things:

* the **manifest** on start-up: the navigation tree and every document's
  metadata, no markdown (≈ 180 KB for the AI course, ≈ 40 KB gzipped);
* a **document** when one is opened;
* **search** results, ranked here with the same rules the engine used.

Search keeps a small per-process index of the folded text (no markdown), keyed
on the course *revision* (row id + creation time + version): the first query of
a revision loads it once, the rest pay one tiny check. Every edit changes the
revision, and so does deleting a course and importing it again, so the index
can never serve results for content that no longer exists. Ranking runs in a
worker thread — it is pure CPU, tens of milliseconds on the AI course — with at
most two rankings at once, and recent answers are kept per revision.
"""

from __future__ import annotations

import asyncio
import posixpath
import re
import threading
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.application.exceptions.exceptions import AppException, BadRequestError, ConflictError, NotFoundError
from src.application.ports.input.course_input_port import CourseInputPort
from src.application.ports.output.course_output_port import CourseOutputPort
from src.domain.models.course_domain import (
    CourseBundle,
    CourseDocDomain,
    CourseDomain,
    CourseSearchHit,
    CourseSectionDomain,
)
from src.domain.utils import course_text

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
#: Path segments under /courses that are routes, not courses.
RESERVED_SLUGS = frozenset({"admin", "import", "export", "search"})

# Identifiers end up in URLs, HTML attributes and CSS classes of the course
# pages. The pages escape them as well; refusing markup characters here keeps a
# hostile or careless import from ever reaching that line of defence.
#: Document ids are path-like and may be Vietnamese ("bài-1.md"): letters,
#: digits and . _ @ + - / — no spaces, quotes or angle brackets.
DOC_ID_RE = re.compile(r"^\w[\w.@+/-]*$")
#: Routes in the engine ("bai/m01-bai-01", OPIc "script/A17").
DOC_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")
KIND_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
SECTION_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
#: Section icons name a symbol of the engine's SVG sprite ("compass", "book").
ICON_NAME_RE = re.compile(r"^[a-z0-9-]*$")

_LIMITS = {"doc_id": 255, "slug": 255, "title": 500, "kind": 32, "tag": 64,
           "section": 64, "section_title": 255, "group_short": 64, "group_title": 255, "icon": 32}

#: Courses whose search index is kept in memory at once (LRU).
SEARCH_CACHE_SIZE = 4
_SEARCH_CACHE: "OrderedDict[str, Tuple[str, List[Dict[str, Any]]]]" = OrderedDict()

#: Recent answers, keyed on (course, revision, query, limit) — a write changes
#: the revision, so an entry is only ever reused for the content it came from.
HITS_CACHE_SIZE = 256
_HITS_CACHE: "OrderedDict[Tuple[str, str, str, int], List[CourseSearchHit]]" = OrderedDict()

#: Rankings running at once in this process. Each holds the GIL for its whole
#: run, so more at once only queue for it — and a burst of public queries
#: would otherwise occupy every thread of the default executor.
_RANK_SLOTS = threading.BoundedSemaphore(2)


def reset_search_cache() -> None:
    _SEARCH_CACHE.clear()
    _HITS_CACHE.clear()


def _rank(rows: Sequence[Dict[str, Any]], terms: List[str], query_f: str) -> List[Tuple[float, int, Dict[str, Any]]]:
    """Score every document; runs in a worker thread (see `_RANK_SLOTS`)."""
    with _RANK_SLOTS:
        scored: List[Tuple[float, int, Dict[str, Any]]] = []
        for row in rows:
            score = course_text.score_doc(row["title_f"], row["heads_f"], row["body_f"], terms, query_f, row["kind"])
            if score > 0:
                scored.append((score, course_text.first_position(row["body_f"], terms), row))
        # Stable sort: equal scores keep navigation order, as the engine's did.
        scored.sort(key=lambda item: -item[0])
        return scored


class PayloadTooLargeError(AppException):
    def __init__(self, message: str):
        super().__init__(message=message, status_code=413, code="payload_too_large")


# ------------------------------------------------------------------ shaping

def course_json(course: CourseDomain, with_tree: bool = False) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "slug": course.slug, "title": course.title, "subtitle": course.subtitle,
        "description": course.description, "icon": course.icon, "config": course.config,
        "stats": course.stats, "published": course.published, "version": course.version,
        "createdAt": course.created_at, "updatedAt": course.updated_at, "docCount": course.doc_count,
    }
    if with_tree:
        out["nav"] = [s.model_dump() for s in course.sections]
    return out


def doc_json(doc: CourseDocDomain, full: bool) -> Dict[str, Any]:
    """A document in the field names the engine and `content.json` use."""
    out: Dict[str, Any] = {
        "id": doc.id, "slug": doc.slug, "title": doc.title, "kind": doc.kind, "tag": doc.tag,
        "section": doc.section, "group": doc.group, "meta": doc.meta,
        "words": doc.words, "minutes": doc.minutes,
    }
    if full:
        out.update({"outline": doc.outline, "codeLines": doc.code_lines, "md": doc.md, "updatedAt": doc.updated_at})
    return out


def _order(sections: Sequence[CourseSectionDomain], docs: Sequence[CourseDocDomain]) -> List[str]:
    order: List[str] = []
    seen = set()
    for sec in sections:
        for grp in sec.groups:
            for doc_id in grp.items:
                if doc_id not in seen:
                    seen.add(doc_id)
                    order.append(doc_id)
    order += [d.id for d in docs if d.id not in seen]
    return order


def _derive_slug(doc_id: str) -> str:
    base = re.sub(r"\.md$", "", doc_id, flags=re.I)
    if posixpath.basename(base).lower() == "readme":
        base = posixpath.dirname(base) or "gioi-thieu"
    slug = re.sub(r"[^a-z0-9/]+", "-", course_text.fold(base)).strip("-/")
    return re.sub(r"-{2,}", "-", slug)[:200] or "bai"


def _check_doc_id(doc_id: str) -> str:
    doc_id = (doc_id or "").strip()
    if not doc_id or len(doc_id) > _LIMITS["doc_id"]:
        raise BadRequestError("Document id must be 1–255 characters")
    if not DOC_ID_RE.match(doc_id) or ".." in doc_id.split("/"):
        raise BadRequestError(f"Invalid document id {doc_id!r}: letters, digits and . _ @ + - / only, "
                              "no '..' segment, not starting with '/'")
    return doc_id


def _check_doc_fields(doc: CourseDocDomain) -> None:
    _fit(doc.slug, "slug", "Document slug")
    _fit(doc.title, "title", "Document title")
    _fit(doc.kind, "kind", "Document kind")
    _fit(doc.tag, "tag", "Document tag")
    if not DOC_SLUG_RE.match(doc.slug or ""):
        raise BadRequestError(f"Invalid document slug {doc.slug!r}: letters, digits and . _ - / only")
    if not KIND_RE.match(doc.kind or ""):
        raise BadRequestError(f"Invalid document kind {doc.kind!r}: lowercase letters, digits and '-'")


def _fit(value: Optional[str], key: str, label: str) -> None:
    if value is not None and len(value) > _LIMITS[key]:
        raise BadRequestError(f"{label} is longer than {_LIMITS[key]} characters: {value[:40]!r}…")


class CourseUseCase(CourseInputPort):
    def __init__(self, repo: CourseOutputPort):
        self.repo = repo

    # ============================================================== guards

    @staticmethod
    def check_slug(slug: str) -> str:
        # Not lower-cased on the caller's behalf: a course created as "Demo" but
        # stored as "demo" would 404 on the very URL its creator typed.
        slug = (slug or "").strip()
        if not SLUG_RE.match(slug) or slug in RESERVED_SLUGS:
            raise BadRequestError("Course slug must be 1–63 lowercase letters, digits or '-', and not a reserved word")
        return slug

    async def _visible(self, slug: str, include_unpublished: bool) -> str:
        """The course revision, or 404 — also for an unpublished course seen by the public."""
        found = await self.repo.course_state(slug)
        if found is None or (not found[1] and not include_unpublished):
            raise NotFoundError(f"Course {slug!r} not found")
        return found[0]

    def _validate_tree(self, sections: Sequence[CourseSectionDomain], known: Optional[set]) -> None:
        seen_sections = set()
        for sec in sections:
            if not sec.id or not sec.title:
                raise BadRequestError("Every section needs an id and a title")
            _fit(sec.id, "section", "Section id")
            _fit(sec.title, "section_title", "Section title")
            _fit(sec.icon, "icon", "Section icon")
            if not SECTION_ID_RE.match(sec.id):
                raise BadRequestError(f"Invalid section id {sec.id!r}: letters, digits, '_' and '-' only")
            if not ICON_NAME_RE.match(sec.icon or ""):
                raise BadRequestError(f"Invalid section icon {sec.icon!r}: the name of an engine icon "
                                      "(lowercase letters, digits and '-')")
            if sec.id in seen_sections:
                raise BadRequestError(f"Duplicate section id {sec.id!r}")
            seen_sections.add(sec.id)
            for grp in sec.groups:
                if not grp.title:
                    raise BadRequestError(f"A group in section {sec.id!r} has no title")
                _fit(grp.title, "group_title", "Group title")
                _fit(grp.short, "group_short", "Group short name")
        if known is not None:
            unknown = [d for sec in sections for grp in sec.groups for d in grp.items if d not in known]
            if unknown:
                raise BadRequestError(f"The tree lists {len(unknown)} unknown document(s): {unknown[:8]}")

    # ============================================================== reading

    async def list_courses(self, include_unpublished: bool = False) -> List[CourseDomain]:
        return await self.repo.list_courses(include_unpublished)

    async def get_course(self, slug: str, include_unpublished: bool = False) -> CourseDomain:
        course = await self.repo.get_course(slug)
        if course is None or (not course.published and not include_unpublished):
            raise NotFoundError(f"Course {slug!r} not found")
        return course

    async def revision(self, slug: str, include_unpublished: bool = False) -> str:
        return await self._visible(slug, include_unpublished)

    async def manifest(self, slug: str, include_unpublished: bool = False) -> Dict[str, Any]:
        found = await self.repo.get_manifest(slug)
        if found is None or (not found[0].published and not include_unpublished):
            raise NotFoundError(f"Course {slug!r} not found")
        course, docs = found
        return {
            "course": course_json(course),
            "nav": [s.model_dump() for s in course.sections],
            "slugs": {d.slug: d.id for d in docs},
            "order": _order(course.sections, docs),
            "docs": {d.id: doc_json(d, full=False) for d in docs},
            "stats": course.stats,
            "version": course.version,
        }

    async def get_doc(self, slug: str, doc_id: str, include_unpublished: bool = False) -> CourseDocDomain:
        await self._visible(slug, include_unpublished)
        doc = await self.repo.get_doc(slug, doc_id)
        if doc is None:
            raise NotFoundError(f"Document {doc_id!r} not found in course {slug!r}")
        return doc

    async def bundle(self, slug: str, include_unpublished: bool = False, enforce_limit: bool = True) -> CourseBundle:
        course = await self.get_course(slug, include_unpublished)
        if enforce_limit:
            from src.application.config.config import settings

            size = await self.repo.markdown_size(slug)
            limit = int(getattr(settings, "COURSE_BULK_MAX_BYTES", 2 * 1024 * 1024))
            if size > limit:
                raise PayloadTooLargeError(
                    f"Course {slug!r} has {size // 1024} KB of markdown, over the {limit // 1024} KB bundle limit; "
                    f"load /courses/{slug}/manifest and fetch documents one at a time instead"
                )
        docs = await self.repo.list_docs_full(slug)
        return CourseBundle(
            course={k: v for k, v in course_json(course).items() if k not in ("docCount",)},
            nav=course.sections,
            slugs={d.slug: d.id for d in docs},
            order=_order(course.sections, docs),
            docs={d.id: d for d in docs},
            stats=course.stats,
        )

    @staticmethod
    def bundle_json(bundle: CourseBundle) -> Dict[str, Any]:
        """The bundle in `content.json` field names — what export writes and import reads."""
        return {
            "course": bundle.course,
            "nav": [s.model_dump() for s in bundle.nav],
            "slugs": bundle.slugs,
            "order": bundle.order,
            "docs": {k: doc_json(d, full=True) for k, d in bundle.docs.items()},
            "stats": bundle.stats,
        }

    async def _index(self, slug: str, revision: str) -> List[Dict[str, Any]]:
        cached = _SEARCH_CACHE.get(slug)
        if cached is not None and cached[0] == revision:
            _SEARCH_CACHE.move_to_end(slug)
            return cached[1]
        rows = await self.repo.search_rows(slug)
        _SEARCH_CACHE[slug] = (revision, rows)
        _SEARCH_CACHE.move_to_end(slug)
        while len(_SEARCH_CACHE) > SEARCH_CACHE_SIZE:
            _SEARCH_CACHE.popitem(last=False)
        return rows

    async def search(self, slug: str, query: str, limit: int = 24, include_unpublished: bool = False) -> List[CourseSearchHit]:
        revision = await self._visible(slug, include_unpublished)
        terms = course_text.terms_of(query or "")
        if not terms:
            return []
        query_f = course_text.fold((query or "").strip())
        limit = max(1, min(int(limit), 100))
        key = (slug, revision, query_f, limit)
        cached = _HITS_CACHE.get(key)
        if cached is not None:
            _HITS_CACHE.move_to_end(key)
            return [hit.model_copy() for hit in cached]

        rows = await self._index(slug, revision)
        top = (await asyncio.to_thread(_rank, rows, terms, query_f))[:limit]

        spans = [(row["id"], max(0, pos - 85), pos + 165 - max(0, pos - 85)) for _, pos, row in top if pos >= 0]
        pieces = await self.repo.excerpts(slug, spans) if spans else {}
        hits = []
        for score, pos, row in top:
            text = course_text.clean_snippet(pieces.get(row["id"], "")) if pos >= 0 else \
                course_text.snippet("", -1, row["outline"])
            hits.append(CourseSearchHit(id=row["id"], slug=row["slug"], title=row["title"], group=row["group"],
                                        kind=row["kind"], score=round(score, 2), snippet=text))
        _HITS_CACHE[key] = hits
        while len(_HITS_CACHE) > HITS_CACHE_SIZE:
            _HITS_CACHE.popitem(last=False)
        return [hit.model_copy() for hit in hits]

    # ============================================================== writing

    def _normalise_bundle(self, bundle: CourseBundle) -> CourseBundle:
        """Fill what an import may omit and reject what the database would."""
        if not bundle.docs:
            raise BadRequestError("The bundle has no documents")
        slugs_seen: Dict[str, str] = {}
        for key, doc in list(bundle.docs.items()):
            doc_id = _check_doc_id(doc.id or key)
            if doc_id != key:
                raise BadRequestError(f"Document key {key!r} does not match its id {doc.id!r}")
            doc.id = doc_id
            doc.title = (doc.title or course_text.title_of(doc.md or "", posixpath.basename(doc_id))).strip()
            doc.slug = (doc.slug or _derive_slug(doc_id)).strip()
            doc.kind = (doc.kind or "lesson").strip()
            _check_doc_fields(doc)
            if doc.slug in slugs_seen:
                raise BadRequestError(f"Documents {slugs_seen[doc.slug]!r} and {doc_id!r} share the slug {doc.slug!r}")
            slugs_seen[doc.slug] = doc_id
        self._validate_tree(bundle.nav, set(bundle.docs))
        return bundle

    async def import_bundle(self, bundle: CourseBundle, slug: Optional[str] = None,
                            course_fields: Optional[Dict[str, Any]] = None) -> CourseDomain:
        meta = dict(bundle.course or {})
        meta.update({k: v for k, v in (course_fields or {}).items() if v is not None})
        slug = self.check_slug(slug or meta.get("slug") or "")
        title = (meta.get("title") or slug).strip()
        course = CourseDomain(
            slug=slug, title=title[:255], subtitle=(meta.get("subtitle") or "")[:255],
            description=meta.get("description") or "", icon=(meta.get("icon") or "")[:32],
            config=dict(meta.get("config") or {}), published=bool(meta.get("published", True)),
        )
        self._normalise_bundle(bundle)
        stored = await self.repo.replace_course(course, bundle)
        _SEARCH_CACHE.pop(slug, None)
        return stored

    async def create_course(self, fields: Dict[str, Any]) -> CourseDomain:
        slug = self.check_slug(fields.get("slug") or "")
        if await self.repo.course_state(slug) is not None:
            raise ConflictError(f"Course {slug!r} already exists")
        title = (fields.get("title") or "").strip()
        if not title:
            raise BadRequestError("A course needs a title")
        return await self.repo.create_course(CourseDomain(
            slug=slug, title=title[:255], subtitle=(fields.get("subtitle") or "")[:255],
            description=fields.get("description") or "", icon=(fields.get("icon") or "")[:32],
            config=dict(fields.get("config") or {}), published=bool(fields.get("published", True)),
        ))

    async def update_course(self, slug: str, fields: Dict[str, Any]) -> CourseDomain:
        if "title" in fields and fields["title"] is not None and not str(fields["title"]).strip():
            raise BadRequestError("The title cannot be empty")
        updated = await self.repo.update_course(slug, fields)
        if updated is None:
            raise NotFoundError(f"Course {slug!r} not found")
        return updated

    async def delete_course(self, slug: str) -> None:
        if not await self.repo.delete_course(slug):
            raise NotFoundError(f"Course {slug!r} not found")
        _SEARCH_CACHE.pop(slug, None)

    async def replace_structure(self, slug: str, sections: List[CourseSectionDomain]) -> CourseDomain:
        docs = await self.repo.list_doc_summaries(slug)
        if not docs and await self.repo.course_state(slug) is None:
            raise NotFoundError(f"Course {slug!r} not found")
        self._validate_tree(sections, {d.id for d in docs})
        updated = await self.repo.replace_structure(slug, sections)
        if updated is None:
            raise NotFoundError(f"Course {slug!r} not found")
        return updated

    async def upsert_doc(self, slug: str, doc_id: str, fields: Dict[str, Any]) -> CourseDocDomain:
        doc_id = _check_doc_id(doc_id)
        if await self.repo.course_state(slug) is None:
            raise NotFoundError(f"Course {slug!r} not found")
        current = await self.repo.get_doc(slug, doc_id)
        md = fields.get("md")
        if current is None:
            md = md or ""
            doc = CourseDocDomain(
                id=doc_id,
                slug=(fields.get("slug") or _derive_slug(doc_id)).strip(),
                title=(fields.get("title") or course_text.title_of(md, posixpath.basename(doc_id))).strip(),
                kind=(fields.get("kind") or "lesson").strip(), tag=fields.get("tag"),
                meta=dict(fields.get("meta") or {}), md=md,
            )
        else:
            doc = current.model_copy()
            for key in ("slug", "title", "kind"):
                if fields.get(key):
                    setattr(doc, key, str(fields[key]).strip())
            if "tag" in fields:
                doc.tag = fields["tag"] or None
            if fields.get("meta") is not None:
                doc.meta = dict(fields["meta"])
            if md is not None:
                doc.md = md
        _check_doc_fields(doc)
        if not doc.title:
            raise BadRequestError("A document needs a title")
        if await self.repo.slug_taken(slug, doc.slug, except_doc=doc_id):
            raise ConflictError(f"Another document in {slug!r} already uses the slug {doc.slug!r}")

        group_ref = None
        if fields.get("section") or fields.get("group"):
            if not (fields.get("section") and fields.get("group")):
                raise BadRequestError("Placing a document needs both 'section' and 'group'")
            group_ref = {"section": fields["section"], "group": fields["group"]}
        try:
            saved = await self.repo.upsert_doc(slug, doc, group_ref)
        except LookupError as cause:
            raise BadRequestError(str(cause)) from cause
        if saved is None:
            raise NotFoundError(f"Course {slug!r} not found")
        return saved

    async def delete_doc(self, slug: str, doc_id: str) -> None:
        if not await self.repo.delete_doc(slug, doc_id):
            raise NotFoundError(f"Document {doc_id!r} not found in course {slug!r}")
