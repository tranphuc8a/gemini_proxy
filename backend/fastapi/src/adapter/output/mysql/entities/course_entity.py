"""Course content tables.

Four tables mirror the three-level tree the course engine renders:

    courses ─┬─ course_sections ─── course_groups ─┐
             └─ course_docs  ◄──────── group_id ───┘

`course_docs.md` is the markdown; the `*_folded` columns are the same text with
Vietnamese diacritics stripped (see `domain.utils.course_text.fold`), stored so
the search index loads ready to rank instead of folding megabytes each time it
is rebuilt. They are derived columns: an SQLAlchemy event recomputes them from
`md` on every ORM insert and update, so a row edited through the sqladmin UI
stays searchable without the editor knowing the rule; the bulk importer fills
them with the same function (`derived_doc_values`).
"""

from __future__ import annotations

import time
from typing import Any, Dict

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.dialects.mysql import LONGBLOB, LONGTEXT
from sqlalchemy.orm import relationship

from src.adapter.output.mysql.db.base import Base
from src.domain.utils import course_text

#: Markdown and its folded copy can exceed MySQL's TEXT (64 KB); the biggest
#: lesson in the AI course is 34 KB of markdown but others may grow.
LongText = Text().with_variant(LONGTEXT, "mysql")
#: Uploaded files; BLOB on MySQL stops at 64 KB.
LongBlob = LargeBinary().with_variant(LONGBLOB, "mysql")


def Ident(length: int):
    """An identifier column that compares EXACTLY on MySQL.

    The default utf8mb4 collations are case- and accent-insensitive, so
    "README.md" and "readme.md" — or "bai" and "bài" — would collide on a
    unique key. Binary collation on MySQL; SQLite compares exactly already.
    """
    return String(length).with_variant(String(length, collation="utf8mb4_bin"), "mysql")


#: utf8mb4 explicitly: lessons are full of emoji callouts (📌 ⚠️ ★).
_MYSQL_TABLE = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


class CourseEntity(Base):
    __tablename__ = "courses"
    # Ids are never reused — the course revision (id + created_at + version)
    # depends on it. InnoDB never reuses an auto-increment value; SQLite does,
    # for the highest deleted rowid, unless the table says AUTOINCREMENT.
    __table_args__ = (dict(_MYSQL_TABLE, sqlite_autoincrement=True),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(Ident(64), nullable=False, unique=True)
    title = Column(String(255), nullable=False)
    subtitle = Column(String(255), nullable=False, default="")
    description = Column(Text, nullable=False, default="")
    icon = Column(String(32), nullable=False, default="")
    config = Column(JSON, nullable=False, default=dict)
    stats = Column(JSON, nullable=False, default=dict)
    published = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(BigInteger, nullable=False, default=lambda: int(time.time()))
    updated_at = Column(BigInteger, nullable=False, default=lambda: int(time.time()))

    sections = relationship(
        "CourseSectionEntity",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseSectionEntity.sort_order",
        passive_deletes=True,
    )
    docs = relationship(
        "CourseDocEntity",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseDocEntity.sort_order",
        passive_deletes=True,
    )

    def __str__(self) -> str:
        return f"{self.slug} — {self.title}"


class CourseSectionEntity(Base):
    __tablename__ = "course_sections"
    __table_args__ = (UniqueConstraint("course_id", "sec_id", name="uq_course_sections_course_sec"), dict(_MYSQL_TABLE))

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    sec_id = Column(Ident(64), nullable=False)
    title = Column(String(255), nullable=False)
    sub = Column(String(255), nullable=False, default="")
    icon = Column(String(32), nullable=False, default="")
    sort_order = Column(Integer, nullable=False, default=0)

    course = relationship("CourseEntity", back_populates="sections")
    groups = relationship(
        "CourseGroupEntity",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="CourseGroupEntity.sort_order",
        passive_deletes=True,
    )

    def __str__(self) -> str:
        return f"{self.sec_id} — {self.title}"


class CourseGroupEntity(Base):
    __tablename__ = "course_groups"
    __table_args__ = (dict(_MYSQL_TABLE),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    short = Column(String(64), nullable=False, default="")
    # Column "meta" in the database, attribute `meta_json` in Python: wtforms
    # reserves `Form.meta`, so a form field named "meta" crashes the sqladmin
    # edit page (AttributeError: 'JSONField' object has no attribute 'wrap_formdata').
    meta_json = Column("meta", JSON, nullable=False, default=dict)
    sort_order = Column(Integer, nullable=False, default=0)

    section = relationship("CourseSectionEntity", back_populates="groups")
    docs = relationship("CourseDocEntity", back_populates="group", order_by="CourseDocEntity.sort_order")

    def __str__(self) -> str:
        return f"{self.short or self.title} (#{self.id})"


class CourseDocEntity(Base):
    __tablename__ = "course_docs"
    __table_args__ = (
        UniqueConstraint("course_id", "doc_id", name="uq_course_docs_course_doc"),
        Index("ix_course_docs_course_slug", "course_id", "slug"),
        dict(_MYSQL_TABLE),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(Integer, ForeignKey("course_groups.id", ondelete="SET NULL"), nullable=True)
    doc_id = Column(Ident(255), nullable=False)
    slug = Column(Ident(255), nullable=False)
    title = Column(String(500), nullable=False)
    kind = Column(String(32), nullable=False, default="lesson")
    tag = Column(String(64), nullable=True)
    meta_json = Column("meta", JSON, nullable=False, default=dict)   # see CourseGroupEntity.meta_json
    outline = Column(JSON, nullable=False, default=list)
    words = Column(Integer, nullable=False, default=0)
    code_lines = Column(Integer, nullable=False, default=0)
    minutes = Column(Integer, nullable=False, default=0)
    md = Column(LongText, nullable=False, default="")
    title_folded = Column(String(500), nullable=False, default="")
    heads_folded = Column(Text, nullable=False, default="")
    body_folded = Column(LongText, nullable=False, default="")
    sort_order = Column(Integer, nullable=False, default=0)
    updated_at = Column(BigInteger, nullable=False, default=lambda: int(time.time()))

    course = relationship("CourseEntity", back_populates="docs")
    group = relationship("CourseGroupEntity", back_populates="docs")

    def __str__(self) -> str:
        return f"{self.doc_id} — {self.title}"


class CourseAssetEntity(Base):
    """A file uploaded to a course. Created by `create_all` at start-up (and by
    migration 0004), so adding it changes no existing table."""

    __tablename__ = "course_assets"
    __table_args__ = (UniqueConstraint("course_id", "name", name="uq_course_assets_course_name"), dict(_MYSQL_TABLE))

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    name = Column(Ident(128), nullable=False)
    mime = Column(String(100), nullable=False)
    size = Column(Integer, nullable=False, default=0)
    sha1 = Column(String(40), nullable=False, default="")
    data = Column(LongBlob, nullable=False)
    created_at = Column(BigInteger, nullable=False, default=lambda: int(time.time()))

    def __str__(self) -> str:
        return f"{self.name} ({self.size} B)"


class CourseDocRevisionEntity(Base):
    """A past version of a document: the one a save replaced, or the one a
    delete removed (`action` = "xoa" — that is also the document's trash entry)."""

    __tablename__ = "course_doc_revisions"
    __table_args__ = (
        Index("ix_course_doc_revisions_doc", "course_id", "doc_id", "saved_at"),
        dict(_MYSQL_TABLE),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    doc_id = Column(Ident(255), nullable=False)
    action = Column(String(16), nullable=False, default="sua")
    title = Column(String(500), nullable=False, default="")
    slug = Column(Ident(255), nullable=False, default="")
    kind = Column(String(32), nullable=False, default="lesson")
    tag = Column(String(64), nullable=True)
    meta_json = Column("meta", JSON, nullable=False, default=dict)
    placement = Column(JSON, nullable=False, default=dict)
    md = Column(LongText, nullable=False, default="")
    words = Column(Integer, nullable=False, default=0)
    saved_at = Column(BigInteger, nullable=False, default=lambda: int(time.time()))


class CourseTrashEntity(Base):
    """A deleted course, kept whole (its export bundle, files included) so it can
    be restored. Not linked to `courses`: the course row is gone."""

    __tablename__ = "course_trash"
    __table_args__ = (dict(_MYSQL_TABLE),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(Ident(64), nullable=False)
    title = Column(String(255), nullable=False, default="")
    doc_count = Column(Integer, nullable=False, default=0)
    bundle = Column(LongText, nullable=False)
    deleted_at = Column(BigInteger, nullable=False, default=lambda: int(time.time()))


def derived_doc_values(md: str, title: str) -> Dict[str, Any]:
    """Every column that is a function of `md` and `title`, as column → value.

    One rule, two callers: the ORM event below (single-row writes, the sqladmin
    form) and the bulk importer, whose multi-row Core INSERT bypasses ORM events.
    """
    outline = course_text.outline(md)
    words, code_lines, minutes = course_text.stats(md)
    return {
        "outline": outline,
        "words": words,
        "code_lines": code_lines,
        "minutes": minutes,
        "title_folded": course_text.fold(title or "")[:500],
        "heads_folded": course_text.fold(course_text.heads_text(outline)),
        "body_folded": course_text.fold(md),
        "updated_at": int(time.time()),
    }


def derive_doc_columns(doc: CourseDocEntity) -> None:
    """Fill the derived columns of an ORM row (see `derived_doc_values`).

    Called from the ORM events below, so the rule holds for every ORM write
    path — the API, the CLI and the sqladmin form alike.
    """
    for column, value in derived_doc_values(doc.md or "", doc.title or "").items():
        setattr(doc, column, value)


@event.listens_for(CourseDocEntity, "before_insert")
@event.listens_for(CourseDocEntity, "before_update")
def _derive_before_write(mapper, connection, doc: CourseDocEntity) -> None:  # noqa: ARG001
    derive_doc_columns(doc)
