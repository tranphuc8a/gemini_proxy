"""Course content API: what the course web pages read, and how an admin manages it.

Reading is public — the pages are public. Writing (import, edit, reorder,
publish, delete) needs `COURSE_ADMIN_KEY`, exchanged for a signed session token
exactly as the markdown editor does, so a browser keeps a token and never the key.
An admin session also sees unpublished courses, which is how a draft is reviewed
before it goes live.

Read responses carry an ETag derived from the course revision (row id, creation
time and version — so a course deleted and imported again never revalidates
against an old copy) and are gzipped when the client accepts it. A course page revalidates on every load; after the
first visit that costs a 304 instead of the manifest.

    GET    /courses                          list (?all=1 with an admin session: drafts too)
    POST   /courses                          create an empty course              [admin]
    POST   /courses/import                   create/replace from a bundle        [admin]
    POST   /courses/admin/verify             admin key → session token
    POST   /courses/admin/session            refresh a session token
    GET    /courses/{slug}                   course + navigation tree
    PATCH  /courses/{slug}                   edit title, description, publish…   [admin]
    DELETE /courses/{slug}                                                        [admin]
    GET    /courses/{slug}/manifest          tree + document metadata, no markdown
    GET    /courses/{slug}/bundle            everything, for small courses only
    GET    /courses/{slug}/export            everything, as a file               [admin]
    GET    /courses/{slug}/search?q=         ranked hits with snippets
    PUT    /courses/{slug}/structure         replace the navigation tree         [admin]
    GET    /courses/{slug}/docs/{doc_id}     one document with markdown
    PUT    /courses/{slug}/docs/{doc_id}     create or update a document         [admin]
    DELETE /courses/{slug}/docs/{doc_id}                                          [admin]
"""

from __future__ import annotations

import gzip
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.adapter.factory.course_factory import get_course_usecase
from src.application.config.config import settings
from src.application.usecases.course_usecase import CourseUseCase, course_json, doc_json
from src.application.utils import admin_session
from src.domain.models.course_domain import CourseBundle, CourseSectionDomain

router = APIRouter(prefix="/courses", tags=["courses"])

#: Namespaces the HMAC so a token minted here cannot be replayed against another
#: app that happens to share the same admin key.
SESSION_SALT = "course-admin"

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


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    published: Optional[bool] = None
    #: Editorial counters kept next to the computed ones ("lessonsPlanned"…).
    stats: Optional[Dict[str, Any]] = None


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


# ---------------------------------------------------------------------- auth

def _admin_key() -> str:
    """The configured key, or "" when course administration is switched off."""
    return (os.getenv("COURSE_ADMIN_KEY") or getattr(settings, "COURSE_ADMIN_KEY", "") or "").strip()


def _session_hours() -> int:
    return int(os.getenv("COURSE_SESSION_HOURS", getattr(settings, "COURSE_SESSION_HOURS", 12)))


def _session_max_seconds() -> int:
    return int(os.getenv("COURSE_SESSION_MAX_DAYS", getattr(settings, "COURSE_SESSION_MAX_DAYS", 7))) * 86400


def _key_matches(provided: Optional[str], expected: str) -> bool:
    # Constant-time: `==` on a secret leaks how long a prefix matched.
    return bool(provided and expected) and hmac.compare_digest(
        provided.encode("utf-8"), expected.encode("utf-8"))


def _is_admin(admin_key: Optional[str], session_token: Optional[str]) -> bool:
    expected = _admin_key()
    if not expected:
        return False
    if _key_matches(admin_key, expected):
        return True
    if session_token:
        try:
            admin_session.verify(session_token, expected, salt=SESSION_SALT)
            return True
        except admin_session.SessionError:
            return False
    return False


def _disabled() -> HTTPException:
    return HTTPException(status_code=403,
                         detail="Course administration is disabled: COURSE_ADMIN_KEY is not set on the server")


def require_admin(
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
) -> None:
    if _is_admin(x_admin_key, x_admin_session):
        return
    if not _admin_key():
        raise _disabled()
    if x_admin_session:
        try:
            admin_session.verify(x_admin_session, _admin_key(), salt=SESSION_SALT)
        except admin_session.SessionError as cause:
            raise HTTPException(status_code=403, detail=str(cause)) from cause
    raise HTTPException(status_code=403, detail="Admin key required")


def optional_admin(
    x_admin_key: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
) -> bool:
    """Reads are public; an admin session additionally sees drafts."""
    return _is_admin(x_admin_key, x_admin_session)


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
async def verify_admin_key(x_admin_key: Optional[str] = Header(default=None)):
    """Exchange the admin key for a session token the browser may keep."""
    expected = _admin_key()
    if not expected:
        raise _disabled()
    if not _key_matches(x_admin_key, expected):
        raise HTTPException(status_code=403, detail="Invalid admin key")
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
        raise HTTPException(status_code=403, detail="Session token required")
    try:
        claims = admin_session.verify_claims(x_admin_session, expected, salt=SESSION_SALT)
    except admin_session.SessionError as cause:
        raise HTTPException(status_code=403, detail=str(cause)) from cause
    now = int(time.time())
    # A token minted before `since` existed counts from its own issue time.
    since = int(claims.get("since") or (int(claims["exp"]) - _session_hours() * 3600))
    if now - since > _session_max_seconds():
        raise HTTPException(status_code=403, detail="Session is too old to refresh; log in with the admin key again")
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
    optionally with a `course` object (title, description, icon, config…)."""
    course = await uc.import_bundle(bundle, slug=slug, course_fields={"title": title} if title else None)
    return _json(request, course_json(course, with_tree=True))


@router.get("/{slug}")
async def get_course(request: Request, slug: str, is_admin: bool = Depends(optional_admin),
                     uc: CourseUseCase = Depends(get_course_usecase)):
    course = await uc.get_course(slug, include_unpublished=is_admin)
    return _json(request, course_json(course, with_tree=True), etag=_etag("course", slug, course.revision, is_admin))


@router.patch("/{slug}", dependencies=[Depends(require_admin)])
async def update_course(request: Request, slug: str, body: CourseUpdate, uc: CourseUseCase = Depends(get_course_usecase)):
    course = await uc.update_course(slug, body.model_dump(exclude_unset=True))
    return _json(request, course_json(course, with_tree=True))


@router.delete("/{slug}", dependencies=[Depends(require_admin)])
async def delete_course(request: Request, slug: str, uc: CourseUseCase = Depends(get_course_usecase)):
    await uc.delete_course(slug)
    return _json(request, {"ok": True, "deleted": slug})


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
    bundle = await uc.bundle(slug, include_unpublished=True, enforce_limit=False)
    return _json(request, uc.bundle_json(bundle), filename=f"{slug}.json")


@router.get("/{slug}/search")
async def search_course(request: Request, slug: str, q: str = Query("", max_length=200),
                        limit: int = Query(24, ge=1, le=100), is_admin: bool = Depends(optional_admin),
                        uc: CourseUseCase = Depends(get_course_usecase)):
    hits = await uc.search(slug, q, limit=limit, include_unpublished=is_admin)
    return _json(request, {"query": q, "hits": [h.model_dump() for h in hits]})


@router.put("/{slug}/structure", dependencies=[Depends(require_admin)])
async def replace_structure(request: Request, slug: str, body: StructureIn, uc: CourseUseCase = Depends(get_course_usecase)):
    course = await uc.replace_structure(slug, body.nav)
    return _json(request, course_json(course, with_tree=True))


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
                     uc: CourseUseCase = Depends(get_course_usecase)):
    doc = await uc.upsert_doc(slug, doc_id, body.model_dump(exclude_unset=True))
    return _json(request, doc_json(doc, full=True))


@router.delete("/{slug}/docs/{doc_id:path}", dependencies=[Depends(require_admin)])
async def delete_doc(request: Request, slug: str, doc_id: str, uc: CourseUseCase = Depends(get_course_usecase)):
    await uc.delete_doc(slug, doc_id)
    return _json(request, {"ok": True, "deleted": doc_id})
