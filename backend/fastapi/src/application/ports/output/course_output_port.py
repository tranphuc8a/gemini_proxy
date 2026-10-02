from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.domain.models.course_domain import (
    CourseAssetDomain,
    CourseBundle,
    CourseDocDomain,
    CourseDomain,
    CourseRevisionDomain,
    CourseSectionDomain,
)


class RevisionConflict(Exception):
    """The stored version is not the one the caller edited (or a document the
    caller meant to create already exists). `current` is what is stored now —
    a domain object, a dict, or None when it is gone."""

    def __init__(self, current: Any = None):
        super().__init__("revision conflict")
        self.current = current


class DocIdTaken(Exception):
    """Another document of the course already has this id."""


class CourseOutputPort(ABC):
    """Persistence of course content. One implementation: the SQL repository.

    Methods that return documents say in their name whether markdown is
    included; listings never carry it.
    """

    # ---- reading ---------------------------------------------------------

    @abstractmethod
    async def list_courses(self, include_unpublished: bool) -> List[CourseDomain]:
        pass

    @abstractmethod
    async def get_course(self, slug: str) -> Optional[CourseDomain]:
        """Course with its navigation tree (sections → groups → doc ids), no documents."""

    @abstractmethod
    async def course_state(self, slug: str) -> Optional[Tuple[str, bool]]:
        """(revision, published) — one cheap row, for cache validation.

        The revision changes with every write AND when a course is deleted and
        created again (its version alone would restart at 1)."""

    @abstractmethod
    async def get_manifest(self, slug: str) -> Optional[Tuple[CourseDomain, List[CourseDocDomain]]]:
        """The course with its tree, and every document's metadata in navigation order."""

    @abstractmethod
    async def list_doc_summaries(self, slug: str) -> List[CourseDocDomain]:
        """Every document's metadata, `md` left empty. In navigation order."""

    @abstractmethod
    async def get_doc(self, slug: str, doc_id: str) -> Optional[CourseDocDomain]:
        """One document with markdown and outline."""

    @abstractmethod
    async def list_docs_full(self, slug: str) -> List[CourseDocDomain]:
        """Every document including markdown — only for export and small courses."""

    @abstractmethod
    async def markdown_size(self, slug: str) -> int:
        """Total size of the course's markdown, to guard the bulk endpoint."""

    @abstractmethod
    async def search_rows(self, slug: str) -> List[Dict[str, Any]]:
        """Folded title/headings/body and display fields of every document. No markdown."""

    @abstractmethod
    async def excerpts(self, slug: str, spans: Sequence[Tuple[str, int, int]]) -> Dict[str, str]:
        """doc_id → a slice of its markdown, for search snippets."""

    @abstractmethod
    async def slug_taken(self, slug: str, doc_slug: str, except_doc: Optional[str] = None) -> bool:
        pass

    # ---- writing ---------------------------------------------------------

    @abstractmethod
    async def create_course(self, course: CourseDomain) -> CourseDomain:
        pass

    @abstractmethod
    async def replace_course(self, course: CourseDomain, bundle: CourseBundle,
                             assets: Optional[Sequence[CourseAssetDomain]] = None) -> CourseDomain:
        """Create or fully replace a course from a bundle. `assets` (when given)
        replace the course's uploaded files. Returns the stored course."""

    @abstractmethod
    async def update_course(self, slug: str, fields: Dict[str, Any],
                            expect_rev: Optional[str] = None) -> Optional[CourseDomain]:
        """Raises RevisionConflict when `expect_rev` is not the current info fingerprint."""

    @abstractmethod
    async def delete_course(self, slug: str, trash: Optional[Dict[str, Any]] = None) -> bool:
        """`trash` = {"title", "doc_count", "bundle" (JSON text)} keeps a restorable copy."""

    @abstractmethod
    async def replace_structure(self, slug: str, sections: List[CourseSectionDomain],
                                expect_rev: Optional[str] = None) -> Optional[CourseDomain]:
        """Replace the navigation tree; documents keep their rows and are re-attached by id."""

    @abstractmethod
    async def upsert_doc(self, slug: str, doc: CourseDocDomain, group_ref: Optional[Dict[str, str]],
                         expect_rev: Optional[str] = None, create_only: bool = False) -> Optional[CourseDocDomain]:
        """Create or update one document. `group_ref` = {section, group} (re)places it.
        The replaced version is kept as a revision; a changed slug leaves an alias."""

    @abstractmethod
    async def delete_doc(self, slug: str, doc_id: str) -> bool:
        """Delete a document, keeping it as an "xoa" revision (the document trash)."""

    @abstractmethod
    async def rename_doc(self, slug: str, old_id: str, new_id: str) -> Optional[CourseDocDomain]:
        """Change a document's id; raises DocIdTaken. Leaves an id alias so learners keep their progress."""

    # ---- history and trash ----------------------------------------------

    @abstractmethod
    async def list_revisions(self, slug: str, doc_id: str) -> List[CourseRevisionDomain]:
        """Past versions of one document, newest first, markdown left empty."""

    @abstractmethod
    async def get_revision(self, slug: str, rev_id: int) -> Optional[CourseRevisionDomain]:
        pass

    @abstractmethod
    async def list_deleted_docs(self) -> List[Tuple[str, str, CourseRevisionDomain, bool]]:
        """(course slug, course title, deleted version without markdown, id in use again)."""

    @abstractmethod
    async def restore_deleted_doc(self, slug: str, rev_id: int) -> Optional[CourseDocDomain]:
        """Re-create a deleted document where it was; raises DocIdTaken."""

    @abstractmethod
    async def add_trash_course(self, slug: str, trash: Dict[str, Any]) -> None:
        """A restorable copy without deleting the course (taken before an import replaces it)."""

    @abstractmethod
    async def list_trash_courses(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_trash_course(self, trash_id: int) -> Optional[Dict[str, Any]]:
        """With the bundle (JSON text)."""

    @abstractmethod
    async def delete_trash_course(self, trash_id: int) -> bool:
        pass

    # ---- uploaded files -------------------------------------------------

    @abstractmethod
    async def list_assets(self, slug: str) -> List[CourseAssetDomain]:
        """Without their bytes."""

    @abstractmethod
    async def get_asset(self, slug: str, name: str) -> Optional[CourseAssetDomain]:
        pass

    @abstractmethod
    async def put_asset(self, slug: str, asset: CourseAssetDomain) -> Optional[CourseAssetDomain]:
        pass

    @abstractmethod
    async def delete_asset(self, slug: str, name: str) -> bool:
        pass

    @abstractmethod
    async def assets_with_data(self, slug: str) -> List[CourseAssetDomain]:
        """Every file with its bytes — for export, duplication and the trash."""
