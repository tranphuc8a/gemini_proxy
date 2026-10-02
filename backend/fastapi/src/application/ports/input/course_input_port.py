from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from src.domain.models.course_domain import (
    CourseBundle,
    CourseDocDomain,
    CourseDomain,
    CourseSearchHit,
    CourseSectionDomain,
)


class CourseInputPort(ABC):
    @abstractmethod
    async def list_courses(self, include_unpublished: bool = False) -> List[CourseDomain]:
        pass

    @abstractmethod
    async def get_course(self, slug: str, include_unpublished: bool = False) -> CourseDomain:
        pass

    @abstractmethod
    async def revision(self, slug: str, include_unpublished: bool = False) -> str:
        """The course's cache key: changes on every write and on delete + re-create."""

    @abstractmethod
    async def manifest(self, slug: str, include_unpublished: bool = False) -> Dict[str, Any]:
        """What the web engine loads on start-up: tree + document metadata, no markdown."""

    @abstractmethod
    async def get_doc(self, slug: str, doc_id: str, include_unpublished: bool = False) -> CourseDocDomain:
        pass

    @abstractmethod
    async def bundle(self, slug: str, include_unpublished: bool = False, enforce_limit: bool = True) -> CourseBundle:
        """The whole course in the import/export format."""

    @abstractmethod
    async def search(self, slug: str, query: str, limit: int = 24,
                     include_unpublished: bool = False) -> List[CourseSearchHit]:
        pass

    @abstractmethod
    async def import_bundle(self, bundle: CourseBundle, slug: Optional[str] = None,
                            course_fields: Optional[Dict[str, Any]] = None) -> CourseDomain:
        pass

    @abstractmethod
    async def create_course(self, fields: Dict[str, Any]) -> CourseDomain:
        pass

    @abstractmethod
    async def update_course(self, slug: str, fields: Dict[str, Any]) -> CourseDomain:
        pass

    @abstractmethod
    async def delete_course(self, slug: str) -> None:
        pass

    @abstractmethod
    async def replace_structure(self, slug: str, sections: List[CourseSectionDomain]) -> CourseDomain:
        pass

    @abstractmethod
    async def upsert_doc(self, slug: str, doc_id: str, fields: Dict[str, Any]) -> CourseDocDomain:
        pass

    @abstractmethod
    async def delete_doc(self, slug: str, doc_id: str) -> None:
        pass
