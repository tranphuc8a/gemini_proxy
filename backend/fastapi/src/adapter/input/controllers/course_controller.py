"""Course content API: what the course web pages read, and how an admin manages it.

Reading is public — the pages are public. Writing (import, edit, reorder,
publish, delete) needs `COURSE_ADMIN_KEY`, exchanged for a signed session token
exactly as the markdown editor does, so a browser keeps a token and never the key.
An admin session also sees unpublished courses, which is how a draft is reviewed
before it goes live.

Read responses carry an ETag derived from the course revision (row id, creation
time and version — so a course deleted and imported again never revalidates
against an old copy) and are gzipped when the client accepts it. A course page
revalidates on every load; after the first visit that costs a 304.

Writes that change something an editor was looking at accept `If-Match: <rev>`
(the `rev` / `treeRev` / `infoRev` the editor loaded): when someone saved in
between, the answer is 409 with the current version in `data.current`, instead
of a silent overwrite. `PUT …/docs/{id}` with `If-None-Match: *` only creates.

    GET    /courses                              list (?all=1 with an admin session: drafts too)
    POST   /courses                              create (optionally from a template)       [admin]
    POST   /courses/import                       create/replace from a bundle              [admin]
    POST   /courses/admin/verify                 admin key → session token (rate limited)
    POST   /courses/admin/session                refresh a session token
    GET    /courses/trash                        deleted courses and documents             [admin]
    POST   /courses/trash/courses/{id}/restore   restore a deleted course                  [admin]
    DELETE /courses/trash/courses/{id}           forget a deleted course                   [admin]
    GET    /courses/{slug}                       course + navigation tree
    PATCH  /courses/{slug}                       edit title, description, publish…         [admin]
    DELETE /courses/{slug}                       → trash                                   [admin]
    POST   /courses/{slug}/duplicate             copy as a draft under a new slug          [admin]
    GET    /courses/{slug}/manifest              tree + document metadata, no markdown
    GET    /courses/{slug}/bundle                everything, for small courses only
    GET    /courses/{slug}/export                everything incl. files, as a file         [admin]
    GET    /courses/{slug}/search?q=             ranked hits with snippets
    GET    /courses/{slug}/links                 broken links, who links to whom           [admin]
    PUT    /courses/{slug}/structure             replace the navigation tree               [admin]
    GET    /courses/{slug}/docs/{doc_id}         one document with markdown
    PUT    /courses/{slug}/docs/{doc_id}         create or update a document               [admin]
    DELETE /courses/{slug}/docs/{doc_id}         → trash                                   [admin]
    POST   /courses/{slug}/rename                change a document's id                    [admin]
    GET    /courses/{slug}/history?doc=          past versions of a document               [admin]
    GET    /courses/{slug}/history/{rev_id}      one past version, with markdown           [admin]
    POST   /courses/{slug}/trash/{rev_id}/restore  restore a deleted document              [admin]
    GET    /courses/{slug}/assets                uploaded files                            [admin]
    PUT    /courses/{slug}/assets/{name}         upload (raw body)                         [admin]
    GET    /courses/{slug}/assets/{name}         a file (public like the course)
    DELETE /courses/{slug}/assets/{name}                                                   [admin]
"""

from __future__ import annotations

import gzip
import hashlib
import json
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from src.adapter.factory.course_factory import get_course_usecase
from src.adapter.input.controllers.admin_auth import (
    SESSION_SALT,
    admin_disabled as _disabled,
    admin_key as _admin_key,
    client_address as _client_address,
    forbidden as _forbidden,
    int_setting as _int_setting,
    key_matches as _key_matches,
    optional_admin,
    require_admin,
    session_problem as _session_problem,
)
from src.application.exceptions.exceptions import AppException
from src.application.usecases.course_usecase import (
    CourseUseCase,
    asset_json,
    course_json,
    doc_json,
    revision_json,
)
from src.application.utils import admin_session
from src.application.utils.rate_limit import FailureWindow
from src.domain.models.course_domain import CourseBundle, CourseSectionDomain
from src.domain.utils.course_rev import parse_if_match

router = APIRouter(prefix="/courses", tags=["courses"])

#: Below this, gzip costs more than it saves.
_GZIP_MIN_BYTES = 1024


# ------------------------------------------------------------------- schemas

class AdminSessionResponse(BaseModel):
    ok: bool = True
    session: str
    expiresAt: int


class CourseCreate(BaseModel):
    slug: str
    title: str
    subtitle: str = ""
    description: str = ""
    icon: str = ""
    config: Dict[str, Any] = Field(default_factory=dict)
    published: bool = True
    #: "trong" (empty), "co-ban", "chu-de" — see domain.utils.course_templates.
    template: str = "trong"


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    published: Optional[bool] = None
    #: Editorial counters kept next to the computed ones ("lessonsPlanned"…).
    stats: Optional[Dict[str, Any]] = None


class CourseCopy(BaseModel):
    slug: str
    title: Optional[str] = None


class StructureIn(BaseModel):
    nav: List[CourseSectionDomain]


class DocUpsert(BaseModel):
    title: Optional[str] = None
    md: Optional[str] = None
    slug: Optional[str] = None
    kind: Optional[str] = None
    tag: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    #: Place (or move) the document: section id + group short name or title.
    section: Optional[str] = None
    group: Optional[str] = None


class DocRename(BaseModel):
    model_config = {"populate_by_name": True}

    old: str = Field(alias="from")
    new: str = Field(alias="to")


class TrashRestore(BaseModel):
    slug: Optional[str] = None


# ---------------------------------------------------------------------- auth
# Who is an administrator lives in admin_auth (the AI features share it); the
# login itself — key for token, refresh, wrong-key limits — is the course API's.

def _session_hours() -> int:
    return _int_setting("COURSE_SESSION_HOURS", 12)


def _session_max_seconds() -> int:
    return _int_setting("COURSE_SESSION_MAX_DAYS", 7) * 86400


#: Wrong admin keys: per client address, and for the whole instance.
_FAILURES = FailureWindow(_int_setting("COURSE_LOGIN_FAILURES", 5), _int_setting("COURSE_LOGIN_WINDOW_SECONDS", 300))
_FAILURES_ALL = FailureWindow(_int_setting("COURSE_LOGIN_FAILURES_GLOBAL", 50),
                              _int_setting("COURSE_LOGIN_WINDOW_SECONDS", 300))


def reset_login_limits() -> None:
    _FAILURES.reset()
    _FAILURES_ALL.reset()


# ------------------------------------------------------------------ response

def _etag(*parts: Any) -> str:
    digest = hashlib.sha1(":".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:20]
    return f'W/"{digest}"'


def _not_modified(request: Request, etag: str) -> bool:
    header = request.headers.get("if-none-match", "")
    return any(tag.strip() == etag for tag in header.split(",")) if header else False


def _json(request: Request, payload: Any, *, etag: Optional[str] = None, status_code: int = 200,
          filename: Optional[str] = None) -> Response:
    headers = {"Cache-Control": "no-cache", "Vary": "Accept-Encoding"}
    if etag:
        headers["ETag"] = etag
        if _not_modified(request, etag):
            return Response(status_code=304, headers=headers)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if filename:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    if len(body) >= _GZIP_MIN_BYTES and "gzip" in request.headers.get("accept-encoding", "").lower():
        body = gzip.compress(body, compresslevel=6)
        headers["Content-Encoding"] = "gzip"
    return Response(content=body, status_code=status_code, media_type="application/json", headers=headers)


# ------------------------------------------------------------------- admin

@router.post("/admin/verify", response_model=AdminSessionResponse)
async def verify_admin_key(request: Request, x_admin_key: Optional[str] = Header(default=None)):
    """Exchange the admin key for a session token the browser may keep.

    Wrong keys are counted: after `COURSE_LOGIN_FAILURES` from one address (or
    `COURSE_LOGIN_FAILURES_GLOBAL` in all) within the window, the answer is 429
    until the window slides — guessing a key one request at a time stops being
    practical.
    """
    expected = _admin_key()
    if not expected:
        raise _disabled()
    who = _client_address(request)
    wait = _FAILURES.retry_after(who) or _FAILURES_ALL.retry_after("*")
    if wait:
        return JSONResponse(status_code=429, headers={"Retry-After": str(wait)}, content={
            "status_code": 429, "data": {"code": "too_many_attempts", "retryAfter": wait},
            "message": f"Nhập sai khoá quá nhiều lần — thử lại sau {wait} giây"})
    if not _key_matches(x_admin_key, expected):
        _FAILURES.fail(who)
        _FAILURES_ALL.fail("*")
        raise _forbidden("Khoá quản trị không đúng", "invalid_key")
    _FAILURES.reset(who)
    now = int(time.time())
    issued = admin_session.issue(expected, salt=SESSION_SALT, ttl_seconds=_session_hours() * 3600, since=now)
    return AdminSessionResponse(session=issued.token, expiresAt=issued.expires_at)


@router.post("/admin/session", response_model=AdminSessionResponse)
async def refresh_admin_session(x_admin_session: Optional[str] = Header(default=None)):
    """A fresh token for a valid one — within `COURSE_SESSION_MAX_DAYS` of the login.

    Without that bound a token, once stolen, could be refreshed forever and
    only rotating the key would stop it.
    """
    expected = _admin_key()
    if not expected:
        raise _disabled()
    if not x_admin_session:
        raise _forbidden("Thiếu token phiên", "session_missing")
    try:
        claims = admin_session.verify_claims(x_admin_session, expected, salt=SESSION_SALT)
    except admin_session.SessionError as cause:
        raise _session_problem(cause) from cause
    now = int(time.time())
    # A token minted before `since` existed counts from its own issue time.
    since = int(claims.get("since") or (int(claims["exp"]) - _session_hours() * 3600))
    if now - since > _session_max_seconds():
        raise _forbidden("Phiên đã quá thời hạn làm mới — nhập lại khoá quản trị", "session_too_old")
    issued = admin_session.issue(expected, salt=SESSION_SALT, ttl_seconds=_session_hours() * 3600, since=since)
    return AdminSessionResponse(session=issued.token, expiresAt=issued.expires_at)


# ------------------------------------------------------------------- courses

@router.get("")
@router.get("/", include_in_schema=False)
async def list_courses(request: Request,
                       include_all: bool = Query(False, alias="all", description="include unpublished (admin)"),
                       is_admin: bool = Depends(optional_admin), uc: CourseUseCase = Depends(get_course_usecase)):
    courses = await uc.list_courses(include_unpublished=bool(include_all and is_admin))
    return _json(request, {"courses": [course_json(c) for c in courses]})


@router.get("/search")
async def search_all_courses(request: Request, q: str = Query("", max_length=200),
                             limit: int = Query(20, ge=1, le=50), uc: CourseUseCase = Depends(get_course_usecase)):
    """Every published course at once (the portal's Ctrl+K). "search" is a reserved
    slug, so this route never hides a course."""
    return _json(request, {"query": q, "hits": await uc.search_all(q, limit=limit)})


@router.post("", dependencies=[Depends(require_admin)], status_code=201)
async def create_course(request: Request, body: CourseCreate, uc: CourseUseCase = Depends(get_course_usecase)):
    course = await uc.create_course(body.model_dump())
    return _json(request, course_json(course, with_tree=True), status_code=201)


@router.post("/import", dependencies=[Depends(require_admin)])
async def import_course(request: Request, bundle: CourseBundle = Body(...),
                        slug: Optional[str] = Query(None, description="defaults to bundle.course.slug"),
                        title: Optional[str] = Query(None),
                        uc: CourseUseCase = Depends(get_course_usecase)):
    """Create or REPLACE a course from a bundle — the old `content.json` format,
    optionally with a `course` object and `assets`. A course that is replaced
    is first copied to the trash."""
    course = await uc.import_bundle(bundle, slug=slug, course_fields={"title": title} if title else None,
                                    keep_backup=True)
    return _json(request, course_json(course, with_tree=True))


@router.get("/trash", dependencies=[Depends(require_admin)])
async def list_trash(request: Request, uc: CourseUseCase = Depends(get_course_usecase)):
    return _json(request, await uc.trash())


@router.post("/trash/courses/{trash_id}/restore", dependencies=[Depends(require_admin)])
async def restore_trash_course(request: Request, trash_id: int, body: TrashRestore = Body(default=TrashRestore()),
                               uc: CourseUseCase = Depends(get_course_usecase)):
    course = await uc.restore_course(trash_id, slug=body.slug)
    return _json(request, course_json(course, with_tree=True))


@router.delete("/trash/courses/{trash_id}", dependencies=[Depends(require_admin)])
async def purge_trash_course(request: Request, trash_id: int, uc: CourseUseCase = Depends(get_course_usecase)):
    await uc.purge_course(trash_id)
    return _json(request, {"ok": True, "deleted": trash_id})


@router.get("/{slug}")
async def get_course(request: Request, slug: str, is_admin: bool = Depends(optional_admin),
                     uc: CourseUseCase = Depends(get_course_usecase)):
    course = await uc.get_course(slug, include_unpublished=is_admin)
    return _json(request, course_json(course, with_tree=True), etag=_etag("course", slug, course.revision, is_admin))


@router.patch("/{slug}", dependencies=[Depends(require_admin)])
async def update_course(request: Request, slug: str, body: CourseUpdate, uc: CourseUseCase = Depends(get_course_usecase),
                        if_match: Optional[str] = Header(default=None)):
    course = await uc.update_course(slug, body.model_dump(exclude_unset=True), expect_rev=parse_if_match(if_match))
    return _json(request, course_json(course, with_tree=True))


@router.delete("/{slug}", dependencies=[Depends(require_admin)])
async def delete_course(request: Request, slug: str, uc: CourseUseCase = Depends(get_course_usecase)):
    await uc.delete_course(slug)
    return _json(request, {"ok": True, "deleted": slug, "trash": True})


@router.post("/{slug}/duplicate", dependencies=[Depends(require_admin)], status_code=201)
async def duplicate_course(request: Request, slug: str, body: CourseCopy, uc: CourseUseCase = Depends(get_course_usecase)):
    course = await uc.duplicate_course(slug, body.slug, body.title)
    return _json(request, course_json(course, with_tree=True), status_code=201)


@router.get("/{slug}/manifest")
async def get_manifest(request: Request, slug: str, is_admin: bool = Depends(optional_admin),
                       uc: CourseUseCase = Depends(get_course_usecase)):
    revision = await uc.revision(slug, include_unpublished=is_admin)
    tag = _etag("manifest", slug, revision, is_admin)
    if _not_modified(request, tag):
        return _json(request, None, etag=tag)
    return _json(request, await uc.manifest(slug, include_unpublished=is_admin), etag=tag)


@router.get("/{slug}/bundle")
async def get_bundle(request: Request, slug: str, is_admin: bool = Depends(optional_admin),
                     uc: CourseUseCase = Depends(get_course_usecase)):
    revision = await uc.revision(slug, include_unpublished=is_admin)
    tag = _etag("bundle", slug, revision, is_admin)
    if _not_modified(request, tag):
        return _json(request, None, etag=tag)
    bundle = await uc.bundle(slug, include_unpublished=is_admin, enforce_limit=not is_admin)
    return _json(request, uc.bundle_json(bundle), etag=tag)


@router.get("/{slug}/export", dependencies=[Depends(require_admin)])
async def export_course(request: Request, slug: str, uc: CourseUseCase = Depends(get_course_usecase)):
    return _json(request, await uc.export_json(slug), filename=f"{slug}.json")


@router.get("/{slug}/search")
async def search_course(request: Request, slug: str, q: str = Query("", max_length=200),
                        limit: int = Query(24, ge=1, le=100), is_admin: bool = Depends(optional_admin),
                        uc: CourseUseCase = Depends(get_course_usecase)):
    hits = await uc.search(slug, q, limit=limit, include_unpublished=is_admin)
    return _json(request, {"query": q, "hits": [h.model_dump() for h in hits]})


@router.get("/{slug}/links", dependencies=[Depends(require_admin)])
async def course_links(request: Request, slug: str, uc: CourseUseCase = Depends(get_course_usecase)):
    return _json(request, await uc.links(slug))


@router.put("/{slug}/structure", dependencies=[Depends(require_admin)])
async def replace_structure(request: Request, slug: str, body: StructureIn, uc: CourseUseCase = Depends(get_course_usecase),
                            if_match: Optional[str] = Header(default=None)):
    course = await uc.replace_structure(slug, body.nav, expect_rev=parse_if_match(if_match))
    return _json(request, course_json(course, with_tree=True))


@router.post("/{slug}/rename", dependencies=[Depends(require_admin)])
async def rename_doc(request: Request, slug: str, body: DocRename, uc: CourseUseCase = Depends(get_course_usecase)):
    doc = await uc.rename_doc(slug, body.old, body.new)
    return _json(request, doc_json(doc, full=True))


@router.get("/{slug}/history", dependencies=[Depends(require_admin)])
async def doc_history(request: Request, slug: str, doc: str = Query(..., min_length=1),
                      uc: CourseUseCase = Depends(get_course_usecase)):
    return _json(request, {"doc": doc, "revisions": [revision_json(r) for r in await uc.revisions(slug, doc)]})


@router.get("/{slug}/history/{rev_id}", dependencies=[Depends(require_admin)])
async def doc_revision(request: Request, slug: str, rev_id: int, uc: CourseUseCase = Depends(get_course_usecase)):
    return _json(request, revision_json(await uc.get_revision(slug, rev_id), with_md=True))


@router.post("/{slug}/trash/{rev_id}/restore", dependencies=[Depends(require_admin)])
async def restore_doc(request: Request, slug: str, rev_id: int, uc: CourseUseCase = Depends(get_course_usecase)):
    doc = await uc.restore_doc(slug, rev_id)
    return _json(request, doc_json(doc, full=True))


@router.get("/{slug}/assets", dependencies=[Depends(require_admin)])
async def list_assets(request: Request, slug: str, uc: CourseUseCase = Depends(get_course_usecase)):
    return _json(request, await uc.list_assets(slug))


@router.put("/{slug}/assets/{name}", dependencies=[Depends(require_admin)], status_code=201)
async def put_asset(request: Request, slug: str, name: str, uc: CourseUseCase = Depends(get_course_usecase)):
    """The file is the raw request body (no multipart): `fetch(url, {method: "PUT", body: file})`."""
    limit = _int_setting("COURSE_ASSET_MAX_BYTES", 3 * 1024 * 1024)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise AppException(message=f"Tệp nặng {int(declared) // 1024} KB, vượt giới hạn {limit // 1024} KB",
                           status_code=413, code="payload_too_large")
    asset = await uc.put_asset(slug, name, await request.body())
    return _json(request, asset_json(asset), status_code=201)


@router.get("/{slug}/assets/{name}")
async def get_asset(request: Request, slug: str, name: str, is_admin: bool = Depends(optional_admin),
                    uc: CourseUseCase = Depends(get_course_usecase)):
    asset = await uc.get_asset(slug, name, include_unpublished=is_admin)
    etag = f'"{asset.sha1}"'
    headers = {
        "ETag": etag,
        # A draft's files are seen by admins only: no shared caches.
        "Cache-Control": "private, no-cache" if is_admin else "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
    }
    if asset.mime.startswith("image/svg"):
        # SVG can carry script; opened directly it must not run on this origin.
        headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"
    inline = asset.mime.startswith(("image/", "application/pdf", "text/", "audio/", "video/"))
    headers["Content-Disposition"] = f'{"inline" if inline else "attachment"}; filename="{asset.name}"'
    if _not_modified(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=asset.data, media_type=asset.mime, headers=headers)


@router.delete("/{slug}/assets/{name}", dependencies=[Depends(require_admin)])
async def delete_asset(request: Request, slug: str, name: str, uc: CourseUseCase = Depends(get_course_usecase)):
    await uc.delete_asset(slug, name)
    return _json(request, {"ok": True, "deleted": name})


@router.get("/{slug}/docs/{doc_id:path}")
async def get_doc(request: Request, slug: str, doc_id: str, is_admin: bool = Depends(optional_admin),
                  uc: CourseUseCase = Depends(get_course_usecase)):
    revision = await uc.revision(slug, include_unpublished=is_admin)
    tag = _etag("doc", slug, revision, doc_id, is_admin)
    if _not_modified(request, tag):
        return _json(request, None, etag=tag)
    doc = await uc.get_doc(slug, doc_id, include_unpublished=is_admin)
    return _json(request, doc_json(doc, full=True), etag=tag)


@router.put("/{slug}/docs/{doc_id:path}", dependencies=[Depends(require_admin)])
async def upsert_doc(request: Request, slug: str, doc_id: str, body: DocUpsert,
                     uc: CourseUseCase = Depends(get_course_usecase),
                     if_match: Optional[str] = Header(default=None),
                     if_none_match: Optional[str] = Header(default=None)):
    doc = await uc.upsert_doc(slug, doc_id, body.model_dump(exclude_unset=True), expect_rev=parse_if_match(if_match),
                              create_only=(if_none_match or "").strip() == "*")
    return _json(request, doc_json(doc, full=True))


@router.delete("/{slug}/docs/{doc_id:path}", dependencies=[Depends(require_admin)])
async def delete_doc(request: Request, slug: str, doc_id: str, uc: CourseUseCase = Depends(get_course_usecase)):
    await uc.delete_doc(slug, doc_id)
    return _json(request, {"ok": True, "deleted": doc_id, "trash": True})
