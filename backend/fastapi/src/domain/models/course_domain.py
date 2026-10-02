"""Course content: what a course *is*, independent of how it is stored or served.

A course is a tree of three levels — section → group → document — plus the
documents themselves, which are markdown. This is exactly the shape the course
web engine already consumed from its bundled `content.js`, so the engine can keep
its mental model while the content moves from a 8 MB script tag into a database.

Two views of the same course are deliberately separate:

* **Manifest** — the tree and every document's metadata, but NO markdown. This is
  what the browser loads on start-up: a few hundred kilobytes instead of
  megabytes, which is the whole point of the refactor.
* **Document** — one document with its markdown, fetched when it is opened.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CourseGroupDomain(BaseModel):
    """A group of documents inside a section (a "môn", a "giai đoạn", a "chủ đề")."""

    title: str
    short: str = ""
    meta: Dict[str, Any] = Field(default_factory=dict)
    #: Document ids, in reading order.
    items: List[str] = Field(default_factory=list)


class CourseSectionDomain(BaseModel):
    """Top level of the navigation tree (a "khoá học", "đồ án", "tài liệu")."""

    id: str
    title: str
    sub: str = ""
    icon: str = ""
    groups: List[CourseGroupDomain] = Field(default_factory=list)


class CourseDocDomain(BaseModel):
    """One document. `md` is empty in manifest listings and filled on fetch."""

    model_config = ConfigDict(from_attributes=True)

    # id, slug and title may be omitted in an import bundle: the id is taken
    # from the bundle key, the slug derived from the id, the title from the
    # first "# heading" (see CourseUseCase._normalise_bundle). Required fields
    # here would turn that fill-in into a 422 before it could run.
    #: Path-like id, stable across edits ("mon-01/bai-giang/bai-01.md").
    id: str = ""
    #: Route in the web engine ("bai/m01-bai-01-...").
    slug: str = ""
    title: str = ""
    kind: str = "lesson"
    tag: Optional[str] = None
    #: Section id and group short name the document is listed under.
    section: str = ""
    group: str = ""
    meta: Dict[str, Any] = Field(default_factory=dict)
    outline: List[Dict[str, Any]] = Field(default_factory=list)
    words: int = 0
    code_lines: int = 0
    minutes: int = 0
    md: str = ""
    updated_at: int = 0
    #: Fingerprint of the editable fields (see domain.utils.course_rev) — sent
    #: back as If-Match so a save cannot overwrite someone else's newer one.
    rev: str = ""


class CourseDomain(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    subtitle: str = ""
    description: str = ""
    icon: str = ""
    #: Course-specific configuration the front-end reads (free-form).
    config: Dict[str, Any] = Field(default_factory=dict)
    #: Cached counters shown on the home page; recomputed on every write.
    stats: Dict[str, Any] = Field(default_factory=dict)
    published: bool = True
    #: Bumped on every change.
    version: int = 1
    #: What caches and ETags are keyed on: row id, creation time and version,
    #: so a course deleted and imported again never matches an old cache entry.
    revision: str = ""
    #: Fingerprints of the course information and of the navigation tree.
    info_rev: str = ""
    tree_rev: str = ""
    created_at: int = 0
    updated_at: int = 0
    sections: List[CourseSectionDomain] = Field(default_factory=list)
    doc_count: int = 0


class CourseBundle(BaseModel):
    """The import/export format — the same shape the old `content.json` had.

    `nav`, `order` and `slugs` are derived from the tree and the documents, but
    they are kept in the format so an existing `content.json` imports unchanged
    and an export is byte-compatible with what `build.py` used to generate.
    """

    course: Optional[Dict[str, Any]] = None
    nav: List[CourseSectionDomain] = Field(default_factory=list)
    slugs: Dict[str, str] = Field(default_factory=dict)
    order: List[str] = Field(default_factory=list)
    docs: Dict[str, CourseDocDomain] = Field(default_factory=dict)
    stats: Dict[str, Any] = Field(default_factory=dict)
    #: Uploaded files, name → {"mime", "data" (base64)} — in exports and backups only.
    assets: Dict[str, Any] = Field(default_factory=dict)


class CourseAssetDomain(BaseModel):
    """A file uploaded to a course (an image a lesson shows, a PDF it links)."""

    name: str
    mime: str
    size: int = 0
    sha1: str = ""
    created_at: int = 0
    data: bytes = b""


class CourseRevisionDomain(BaseModel):
    """A past version of a document — saved before each change and on delete."""

    id: int = 0
    doc_id: str
    #: "sua" (the version before a save), "xoa" (the version that was deleted).
    action: str = "sua"
    title: str = ""
    slug: str = ""
    kind: str = "lesson"
    tag: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    md: str = ""
    words: int = 0
    saved_at: int = 0
    #: Where a deleted document sat: {"section": id, "group": label}.
    placement: Dict[str, Any] = Field(default_factory=dict)


class CourseSearchHit(BaseModel):
    id: str
    slug: str
    title: str
    group: str = ""
    kind: str = "lesson"
    score: float = 0
    snippet: str = ""
