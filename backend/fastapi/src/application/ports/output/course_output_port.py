from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Sequence, Tuple

from src.domain.models.course_domain import (
    CourseBundle,
    CourseDocDomain,
    CourseDomain,
    CourseSectionDomain,
)


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
    async def replace_course(self, course: CourseDomain, bundle: CourseBundle) -> CourseDomain:
        """Create or fully replace a course from a bundle. Returns the stored course."""

    @abstractmethod
    async def update_course(self, slug: str, fields: Dict[str, Any]) -> Optional[CourseDomain]:
        pass

    @abstractmethod
    async def delete_course(self, slug: str) -> bool:
        pass

    @abstractmethod
    async def replace_structure(self, slug: str, sections: List[CourseSectionDomain]) -> Optional[CourseDomain]:
        """Replace the navigation tree; documents keep their rows and are re-attached by id."""

    @abstractmethod
    async def upsert_doc(self, slug: str, doc: CourseDocDomain, group_ref: Optional[Dict[str, str]]) -> Optional[CourseDocDomain]:
        """Create or update one document. `group_ref` = {section, group} (re)places it."""

    @abstractmethod
    async def delete_doc(self, slug: str, doc_id: str) -> bool:
        pass
