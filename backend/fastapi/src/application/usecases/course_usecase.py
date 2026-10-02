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

Editing is built so that work is not lost: a save carries the fingerprint of
the version the editor loaded and is refused (409) if someone saved in
between; the replaced version of a document is kept (history); a deleted
document or course goes to a trash for 30 days. Messages are in Vietnamese —
they are read by the people using the management page and the CLI.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import posixpath
import re
import threading
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.application.exceptions.exceptions import AppException, BadRequestError, ConflictError, NotFoundError
from src.application.ports.input.course_input_port import CourseInputPort
from src.application.ports.output.course_output_port import CourseOutputPort, DocIdTaken, RevisionConflict
from src.domain.models.course_domain import (
    CourseAssetDomain,
    CourseBundle,
    CourseDocDomain,
    CourseDomain,
    CourseRevisionDomain,
    CourseSearchHit,
    CourseSectionDomain,
)
from src.domain.utils import course_assets, course_links, course_templates, course_text
from src.domain.utils.course_rev import RESERVED_CONFIG_KEYS, public_config

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
#: Path segments under /courses that are routes, not courses.
RESERVED_SLUGS = frozenset({"admin", "import", "export", "search", "trash"})

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


def _forget(slug: str) -> None:
    _SEARCH_CACHE.pop(slug, None)


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


def _setting(name: str, default: int) -> int:
    from src.application.config.config import settings

    return int(getattr(settings, name, default) or default)


class PayloadTooLargeError(AppException):
    def __init__(self, message: str):
        super().__init__(message=message, status_code=413, code="payload_too_large")


# ------------------------------------------------------------------ shaping

def course_json(course: CourseDomain, with_tree: bool = False, full_config: bool = False) -> Dict[str, Any]:
    """`full_config` keeps the server-kept tables (aliases) — for exports only;
    the editor never sees them."""
    out: Dict[str, Any] = {
        "slug": course.slug, "title": course.title, "subtitle": course.subtitle,
        "description": course.description, "icon": course.icon,
        "config": dict(course.config) if full_config else public_config(course.config),
        "stats": course.stats, "published": course.published, "version": course.version,
        "createdAt": course.created_at, "updatedAt": course.updated_at, "docCount": course.doc_count,
        "infoRev": course.info_rev,
    }
    if with_tree:
        out["nav"] = [s.model_dump() for s in course.sections]
        out["treeRev"] = course.tree_rev
    return out


def doc_json(doc: CourseDocDomain, full: bool) -> Dict[str, Any]:
    """A document in the field names the engine and `content.json` use."""
    out: Dict[str, Any] = {
        "id": doc.id, "slug": doc.slug, "title": doc.title, "kind": doc.kind, "tag": doc.tag,
        "section": doc.section, "group": doc.group, "meta": doc.meta,
        "words": doc.words, "minutes": doc.minutes,
    }
    if full:
        out.update({"outline": doc.outline, "codeLines": doc.code_lines, "md": doc.md, "updatedAt": doc.updated_at,
                    "rev": doc.rev})
    return out


def revision_json(rev: CourseRevisionDomain, with_md: bool = False) -> Dict[str, Any]:
    out = {"id": rev.id, "docId": rev.doc_id, "action": rev.action, "title": rev.title, "slug": rev.slug,
           "kind": rev.kind, "tag": rev.tag, "words": rev.words, "savedAt": rev.saved_at, "placement": rev.placement}
    if with_md:
        out.update({"md": rev.md, "meta": rev.meta})
    return out


def asset_json(asset: CourseAssetDomain, used_by: Optional[List[str]] = None) -> Dict[str, Any]:
    image = course_assets.is_image(asset.name)
    return {"name": asset.name, "mime": asset.mime, "size": asset.size, "sha1": asset.sha1,
            "createdAt": asset.created_at, "image": image,
            # What to paste into a lesson: the engine maps assets/<name> to this course's file.
            "markdown": f"![](assets/{asset.name})" if image else f"[{asset.name}](assets/{asset.name})",
            "usedBy": used_by or []}


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
        raise BadRequestError("Id bài phải dài 1–255 ký tự")
    if not DOC_ID_RE.match(doc_id) or ".." in doc_id.split("/"):
        raise BadRequestError(f"Id bài {doc_id!r} không hợp lệ: chỉ chữ, số và . _ @ + - /, "
                              "không có đoạn '..', không bắt đầu bằng '/'")
    return doc_id


def _check_doc_fields(doc: CourseDocDomain) -> None:
    _fit(doc.slug, "slug", "Slug bài")
    _fit(doc.title, "title", "Tiêu đề bài")
    _fit(doc.kind, "kind", "Loại bài")
    _fit(doc.tag, "tag", "Nhãn bài")
    if not DOC_SLUG_RE.match(doc.slug or ""):
        raise BadRequestError(f"Slug bài {doc.slug!r} không hợp lệ: chỉ chữ không dấu, số và . _ - /")
    if not KIND_RE.match(doc.kind or ""):
        raise BadRequestError(f"Loại bài {doc.kind!r} không hợp lệ: chữ thường không dấu, số và '-' (vd: lesson, ref)")
    limit = _setting("COURSE_DOC_MAX_BYTES", 1024 * 1024)
    size = len((doc.md or "").encode("utf-8"))
    if size > limit:
        raise PayloadTooLargeError(f"Bài {doc.id!r} có {size // 1024} KB markdown, vượt giới hạn {limit // 1024} KB "
                                   "một bài — hãy tách thành nhiều bài")


def _fit(value: Optional[str], key: str, label: str) -> None:
    if value is not None and len(value) > _LIMITS[key]:
        raise BadRequestError(f"{label} dài quá {_LIMITS[key]} ký tự: {value[:40]!r}…")


def _conflict_doc(current: Any) -> ConflictError:
    if current is None:
        return ConflictError("Bài này vừa bị xoá hoặc đổi id ở nơi khác", payload={"current": None})
    return ConflictError("Bài này vừa được lưu ở nơi khác — xem bản mới rồi chọn giữ bản nào",
                         payload={"current": doc_json(current, full=True)})


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
            raise BadRequestError("Slug khoá học phải gồm 1–63 chữ thường không dấu, số hoặc '-', "
                                  "và không trùng từ dành riêng (admin, import, export, search, trash)")
        return slug

    async def _visible(self, slug: str, include_unpublished: bool) -> str:
        """The course revision, or 404 — also for an unpublished course seen by the public."""
        found = await self.repo.course_state(slug)
        if found is None or (not found[1] and not include_unpublished):
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        return found[0]

    async def _must_exist(self, slug: str) -> None:
        if await self.repo.course_state(slug) is None:
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")

    def _validate_tree(self, sections: Sequence[CourseSectionDomain], known: Optional[set]) -> None:
        seen_sections = set()
        for sec in sections:
            if not sec.id or not sec.title:
                raise BadRequestError("Section nào cũng cần id và tiêu đề")
            _fit(sec.id, "section", "Id section")
            _fit(sec.title, "section_title", "Tiêu đề section")
            _fit(sec.icon, "icon", "Biểu tượng section")
            if not SECTION_ID_RE.match(sec.id):
                raise BadRequestError(f"Id section {sec.id!r} không hợp lệ: chỉ chữ không dấu, số, '_' và '-'")
            if not ICON_NAME_RE.match(sec.icon or ""):
                raise BadRequestError(f"Biểu tượng section {sec.icon!r} không hợp lệ: tên một biểu tượng của trang "
                                      "(chữ thường, số và '-')")
            if sec.id in seen_sections:
                raise BadRequestError(f"Trùng id section {sec.id!r}")
            seen_sections.add(sec.id)
            for grp in sec.groups:
                if not grp.title:
                    raise BadRequestError(f"Một nhóm trong section {sec.id!r} chưa có tiêu đề")
                _fit(grp.title, "group_title", "Tiêu đề nhóm")
                _fit(grp.short, "group_short", "Tên ngắn của nhóm")
        if known is not None:
            unknown = [d for sec in sections for grp in sec.groups for d in grp.items if d not in known]
            if unknown:
                raise BadRequestError(f"Mục lục nhắc tới {len(unknown)} bài không có trong khoá: {unknown[:8]}")

    # ============================================================== reading

    async def list_courses(self, include_unpublished: bool = False) -> List[CourseDomain]:
        return await self.repo.list_courses(include_unpublished)

    async def get_course(self, slug: str, include_unpublished: bool = False) -> CourseDomain:
        course = await self.repo.get_course(slug)
        if course is None or (not course.published and not include_unpublished):
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        return course

    async def revision(self, slug: str, include_unpublished: bool = False) -> str:
        return await self._visible(slug, include_unpublished)

    async def manifest(self, slug: str, include_unpublished: bool = False) -> Dict[str, Any]:
        found = await self.repo.get_manifest(slug)
        if found is None or (not found[0].published and not include_unpublished):
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        course, docs = found
        ids = {d.id for d in docs}
        cfg = course.config or {}
        return {
            "course": course_json(course),
            "nav": [s.model_dump() for s in course.sections],
            "slugs": {d.slug: d.id for d in docs},
            "order": _order(course.sections, docs),
            "docs": {d.id: doc_json(d, full=False) for d in docs},
            "stats": course.stats,
            "version": course.version,
            # Old addresses that still lead somewhere: a renamed slug, a renamed
            # id (the page moves a learner's progress across with it).
            "aliases": {k: v for k, v in dict(cfg.get("slugAliases") or {}).items() if v in ids},
            "idAliases": dict(cfg.get("idAliases") or {}),
        }

    async def get_doc(self, slug: str, doc_id: str, include_unpublished: bool = False) -> CourseDocDomain:
        await self._visible(slug, include_unpublished)
        doc = await self.repo.get_doc(slug, doc_id)
        if doc is None:
            raise NotFoundError(f"Không có bài {doc_id!r} trong khoá {slug!r}")
        return doc

    async def bundle(self, slug: str, include_unpublished: bool = False, enforce_limit: bool = True) -> CourseBundle:
        course = await self.get_course(slug, include_unpublished)
        if enforce_limit:
            size = await self.repo.markdown_size(slug)
            limit = _setting("COURSE_BULK_MAX_BYTES", 2 * 1024 * 1024)
            if size > limit:
                raise PayloadTooLargeError(
                    f"Khoá {slug!r} có {size // 1024} KB markdown, vượt giới hạn {limit // 1024} KB của bundle; "
                    f"hãy đọc /courses/{slug}/manifest rồi tải từng bài"
                )
        docs = await self.repo.list_docs_full(slug)
        return CourseBundle(
            course={k: v for k, v in course_json(course, full_config=True).items()
                    if k not in ("docCount", "infoRev")},
            nav=course.sections,
            slugs={d.slug: d.id for d in docs},
            order=_order(course.sections, docs),
            docs={d.id: d for d in docs},
            stats=course.stats,
        )

    @staticmethod
    def bundle_json(bundle: CourseBundle) -> Dict[str, Any]:
        """The bundle in `content.json` field names — what export writes and import reads."""
        out = {
            "course": bundle.course,
            "nav": [s.model_dump() for s in bundle.nav],
            "slugs": bundle.slugs,
            "order": bundle.order,
            "docs": {k: {kk: vv for kk, vv in doc_json(d, full=True).items() if kk != "rev"}
                     for k, d in bundle.docs.items()},
            "stats": bundle.stats,
        }
        if bundle.assets:
            out["assets"] = bundle.assets
        return out

    async def export_json(self, slug: str) -> Dict[str, Any]:
        """Everything, files included (base64) — the backup a deleted course is kept as."""
        bundle = await self.bundle(slug, include_unpublished=True, enforce_limit=False)
        bundle.assets = {a.name: {"mime": a.mime, "data": base64.b64encode(a.data).decode("ascii")}
                         for a in await self.repo.assets_with_data(slug)}
        return self.bundle_json(bundle)

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

    async def links(self, slug: str) -> Dict[str, Any]:
        """Broken internal links, and who links to whom (for "delete this lesson?")."""
        course = await self.get_course(slug, include_unpublished=True)
        docs = await self.repo.list_docs_full(slug)
        assets = await self.repo.list_assets(slug)
        report = course_links.scan({d.id: d.md for d in docs}, {d.slug: d.id for d in docs},
                                   dict((course.config or {}).get("slugAliases") or {}), [a.name for a in assets])
        titles = {d.id: d.title for d in docs}
        for item in report["broken"]:
            item["fromTitle"] = titles.get(item["from"], item["from"])
        report["docCount"] = len(docs)
        return report

    # ============================================================== writing

    def _normalise_bundle(self, bundle: CourseBundle) -> CourseBundle:
        """Fill what an import may omit and reject what the database would."""
        if not bundle.docs:
            raise BadRequestError("Bundle không có bài nào")
        slugs_seen: Dict[str, str] = {}
        for key, doc in list(bundle.docs.items()):
            doc_id = _check_doc_id(doc.id or key)
            if doc_id != key:
                raise BadRequestError(f"Khoá {key!r} của bài không khớp id {doc.id!r}")
            doc.id = doc_id
            doc.title = (doc.title or course_text.title_of(doc.md or "", posixpath.basename(doc_id))).strip()
            doc.slug = (doc.slug or _derive_slug(doc_id)).strip()
            doc.kind = (doc.kind or "lesson").strip()
            _check_doc_fields(doc)
            if doc.slug in slugs_seen:
                raise BadRequestError(f"Hai bài {slugs_seen[doc.slug]!r} và {doc_id!r} trùng slug {doc.slug!r}")
            slugs_seen[doc.slug] = doc_id
        self._validate_tree(bundle.nav, set(bundle.docs))
        return bundle

    def _bundle_assets(self, bundle: CourseBundle) -> Optional[List[CourseAssetDomain]]:
        if not bundle.assets:
            return None
        out = []
        for raw_name, item in bundle.assets.items():
            name = course_assets.clean_name(raw_name)
            try:
                data = base64.b64decode((item or {}).get("data") or "", validate=True)
            except Exception as cause:  # noqa: BLE001
                raise BadRequestError(f"Tệp {raw_name!r} trong bundle không phải base64 hợp lệ") from cause
            out.append(self._checked_asset(name, data))
        return out

    async def import_bundle(self, bundle: CourseBundle, slug: Optional[str] = None,
                            course_fields: Optional[Dict[str, Any]] = None, keep_backup: bool = False) -> CourseDomain:
        """Create or REPLACE a course. `keep_backup` puts the replaced course in
        the trash first (the management page's import does; the CLI, which
        loads the canonical bundle from the repository, does not)."""
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
        assets = self._bundle_assets(bundle)
        if keep_backup and await self.repo.course_state(slug) is not None:
            await self._to_trash(slug, delete=False)
        stored = await self.repo.replace_course(course, bundle, assets)
        _forget(slug)
        return stored

    async def create_course(self, fields: Dict[str, Any]) -> CourseDomain:
        slug = self.check_slug(fields.get("slug") or "")
        if await self.repo.course_state(slug) is not None:
            raise ConflictError(f"Đã có khoá học {slug!r}")
        title = (fields.get("title") or "").strip()
        if not title:
            raise BadRequestError("Khoá học cần tiêu đề")
        template = (fields.get("template") or "trong").strip()
        if template not in course_templates.TEMPLATES:
            raise BadRequestError(f"Không có mẫu khoá học {template!r}; có: {', '.join(course_templates.TEMPLATES)}")
        course = CourseDomain(
            slug=slug, title=title[:255], subtitle=(fields.get("subtitle") or "")[:255],
            description=fields.get("description") or "", icon=(fields.get("icon") or "")[:32],
            config=dict(fields.get("config") or {}), published=bool(fields.get("published", True)),
        )
        if template == "trong":
            return await self.repo.create_course(course)
        nav, docs = course_templates.build(template, title)
        bundle = CourseBundle.model_validate({"nav": nav, "docs": docs})
        self._normalise_bundle(bundle)
        stored = await self.repo.replace_course(course, bundle)
        _forget(slug)
        return stored

    async def duplicate_course(self, slug: str, new_slug: str, title: Optional[str] = None) -> CourseDomain:
        """A copy as a draft — content, tree and files — under a new slug."""
        new_slug = self.check_slug(new_slug)
        if await self.repo.course_state(new_slug) is not None:
            raise ConflictError(f"Đã có khoá học {new_slug!r}")
        source = await self.bundle(slug, include_unpublished=True, enforce_limit=False)
        files = await self.repo.assets_with_data(slug)
        meta = dict(source.course or {})
        meta.update({"slug": new_slug, "title": (title or "").strip() or f"{meta.get('title') or slug} (bản sao)",
                     "published": False})
        cfg = dict(meta.get("config") or {})
        cfg.pop("webapp", None)       # the custom page belongs to the original course
        meta["config"] = cfg
        course = CourseDomain(slug=new_slug, title=meta["title"][:255], subtitle=(meta.get("subtitle") or "")[:255],
                              description=meta.get("description") or "", icon=(meta.get("icon") or "")[:32],
                              config=cfg, published=False)
        stored = await self.repo.replace_course(course, source, files)
        _forget(new_slug)
        return stored

    async def update_course(self, slug: str, fields: Dict[str, Any], expect_rev: Optional[str] = None) -> CourseDomain:
        if "title" in fields and fields["title"] is not None and not str(fields["title"]).strip():
            raise BadRequestError("Tiêu đề khoá học không được để trống")
        if fields.get("config") is not None:
            fields = dict(fields, config={k: v for k, v in dict(fields["config"]).items()
                                          if k not in RESERVED_CONFIG_KEYS})
        try:
            updated = await self.repo.update_course(slug, fields, expect_rev)
        except RevisionConflict as conflict:
            raise ConflictError("Thông tin khoá vừa được sửa ở nơi khác — tải lại để xem bản mới",
                                payload={"current": course_json(conflict.current)}) from conflict
        if updated is None:
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        _forget(slug)
        return updated

    async def _to_trash(self, slug: str, delete: bool) -> bool:
        """Keep the whole course (files included) in the trash; `delete` also
        removes it — otherwise it is a backup taken before an import replaces it."""
        data = await self.export_json(slug)
        trash = {"title": (data.get("course") or {}).get("title") or slug, "doc_count": len(data.get("docs") or {}),
                 "bundle": json.dumps(data, ensure_ascii=False, separators=(",", ":"))}
        if delete:
            return await self.repo.delete_course(slug, trash=trash)
        await self.repo.add_trash_course(slug, trash)
        return True

    async def delete_course(self, slug: str) -> None:
        await self._must_exist(slug)
        if not await self._to_trash(slug, delete=True):
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        _forget(slug)

    async def replace_structure(self, slug: str, sections: List[CourseSectionDomain],
                                expect_rev: Optional[str] = None) -> CourseDomain:
        docs = await self.repo.list_doc_summaries(slug)
        if not docs:
            await self._must_exist(slug)
        self._validate_tree(sections, {d.id for d in docs})
        try:
            updated = await self.repo.replace_structure(slug, sections, expect_rev)
        except RevisionConflict as conflict:
            raise ConflictError("Mục lục vừa được sửa ở nơi khác — tải lại để xem bản mới",
                                payload={"current": conflict.current}) from conflict
        if updated is None:
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        return updated

    async def upsert_doc(self, slug: str, doc_id: str, fields: Dict[str, Any], expect_rev: Optional[str] = None,
                         create_only: bool = False) -> CourseDocDomain:
        doc_id = _check_doc_id(doc_id)
        await self._must_exist(slug)
        current = await self.repo.get_doc(slug, doc_id)
        if create_only and current is not None:
            raise ConflictError(f"Đã có bài mang id {doc_id!r} — mở bài đó để sửa, hoặc chọn id khác",
                                payload={"current": doc_json(current, full=True)})
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
            raise BadRequestError("Bài cần tiêu đề")
        if await self.repo.slug_taken(slug, doc.slug, except_doc=doc_id):
            raise ConflictError(f"Một bài khác trong khoá {slug!r} đã dùng slug {doc.slug!r}")

        group_ref = None
        if fields.get("section") or fields.get("group"):
            if not (fields.get("section") and fields.get("group")):
                raise BadRequestError("Đặt bài vào mục lục cần cả 'section' lẫn 'group'")
            group_ref = {"section": fields["section"], "group": fields["group"]}
        try:
            saved = await self.repo.upsert_doc(slug, doc, group_ref, expect_rev, create_only)
        except LookupError as cause:
            raise BadRequestError(str(cause)) from cause
        except RevisionConflict as conflict:
            raise _conflict_doc(conflict.current) from conflict
        if saved is None:
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        return saved

    async def delete_doc(self, slug: str, doc_id: str) -> None:
        if not await self.repo.delete_doc(slug, doc_id):
            raise NotFoundError(f"Không có bài {doc_id!r} trong khoá {slug!r}")

    async def rename_doc(self, slug: str, doc_id: str, new_id: str) -> CourseDocDomain:
        new_id = _check_doc_id(new_id)
        if new_id == doc_id:
            raise BadRequestError("Id mới trùng id cũ")
        try:
            doc = await self.repo.rename_doc(slug, doc_id, new_id)
        except DocIdTaken as cause:
            raise ConflictError(f"Đã có bài mang id {new_id!r}") from cause
        if doc is None:
            raise NotFoundError(f"Không có bài {doc_id!r} trong khoá {slug!r}")
        return doc

    # ============================================================== history and trash

    async def revisions(self, slug: str, doc_id: str) -> List[CourseRevisionDomain]:
        await self._must_exist(slug)
        return await self.repo.list_revisions(slug, doc_id)

    async def get_revision(self, slug: str, rev_id: int) -> CourseRevisionDomain:
        rev = await self.repo.get_revision(slug, rev_id)
        if rev is None:
            raise NotFoundError(f"Không có phiên bản #{rev_id} trong khoá {slug!r}")
        return rev

    async def trash(self) -> Dict[str, Any]:
        courses = await self.repo.list_trash_courses()
        docs = [{"courseSlug": s, "courseTitle": t, "idInUse": used, **revision_json(r)}
                for s, t, r, used in await self.repo.list_deleted_docs()]
        return {"courses": courses, "docs": docs}

    async def restore_course(self, trash_id: int, slug: Optional[str] = None) -> CourseDomain:
        item = await self.repo.get_trash_course(trash_id)
        if item is None:
            raise NotFoundError(f"Không còn mục #{trash_id} trong thùng rác")
        target = self.check_slug(slug or item["slug"])
        if await self.repo.course_state(target) is not None:
            raise ConflictError(f"Đã có khoá học {target!r} — chọn slug khác để khôi phục",
                                payload={"slugTaken": target})
        bundle = CourseBundle.model_validate(json.loads(item["bundle"]))
        restored = await self.import_bundle(bundle, slug=target)
        await self.repo.delete_trash_course(trash_id)
        return restored

    async def purge_course(self, trash_id: int) -> None:
        if not await self.repo.delete_trash_course(trash_id):
            raise NotFoundError(f"Không còn mục #{trash_id} trong thùng rác")

    async def restore_doc(self, slug: str, rev_id: int) -> CourseDocDomain:
        try:
            doc = await self.repo.restore_deleted_doc(slug, rev_id)
        except DocIdTaken as cause:
            raise ConflictError(f"Khoá {slug!r} đã có bài mang id {cause.args[0]!r} — đổi id bài đó trước") from cause
        if doc is None:
            raise NotFoundError(f"Không có bài đã xoá #{rev_id} trong khoá {slug!r}")
        return doc

    # ============================================================== uploaded files

    @staticmethod
    def _checked_asset(name: str, data: bytes) -> CourseAssetDomain:
        if not course_assets.NAME_RE.match(name or ""):
            raise BadRequestError(f"Tên tệp {name!r} không hợp lệ: chữ thường không dấu, số, . _ -")
        mime = course_assets.media_type(name)
        if mime is None:
            raise BadRequestError("Không nhận loại tệp này — chỉ ảnh (png, jpg, gif, webp, svg, avif), pdf, txt, "
                                  "csv, json, zip, mp3, mp4, py, ipynb")
        if not data:
            raise BadRequestError("Tệp rỗng")
        limit = _setting("COURSE_ASSET_MAX_BYTES", 3 * 1024 * 1024)
        if len(data) > limit:
            raise PayloadTooLargeError(f"Tệp {name!r} nặng {len(data) // 1024} KB, vượt giới hạn {limit // 1024} KB")
        return CourseAssetDomain(name=name, mime=mime, size=len(data), sha1=hashlib.sha1(data).hexdigest(), data=data)

    async def list_assets(self, slug: str) -> Dict[str, Any]:
        assets = await self.repo.list_assets(slug)
        used = (await self.links(slug))["assetUse"] if assets else {}
        return {"assets": [asset_json(a, used.get(a.name, [])) for a in assets]}

    async def put_asset(self, slug: str, filename: str, data: bytes) -> CourseAssetDomain:
        await self._must_exist(slug)
        asset = self._checked_asset(course_assets.clean_name(filename), data)
        saved = await self.repo.put_asset(slug, asset)
        if saved is None:
            raise NotFoundError(f"Không tìm thấy khoá học {slug!r}")
        return saved

    async def get_asset(self, slug: str, name: str, include_unpublished: bool = False) -> CourseAssetDomain:
        await self._visible(slug, include_unpublished)
        asset = await self.repo.get_asset(slug, name)
        if asset is None:
            raise NotFoundError(f"Không có tệp {name!r} trong khoá {slug!r}")
        return asset

    async def delete_asset(self, slug: str, name: str) -> None:
        if not await self.repo.delete_asset(slug, name):
            raise NotFoundError(f"Không có tệp {name!r} trong khoá {slug!r}")
