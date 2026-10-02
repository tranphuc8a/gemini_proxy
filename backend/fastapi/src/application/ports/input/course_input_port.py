from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from src.domain.models.course_domain import (
    CourseAssetDomain,
    CourseBundle,
    CourseDocDomain,
    CourseDomain,
    CourseRevisionDomain,
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
    async def links(self, slug: str) -> Dict[str, Any]:
        """Broken internal links, who links to whom, which files are used."""

    @abstractmethod
    async def import_bundle(self, bundle: CourseBundle, slug: Optional[str] = None,
                            course_fields: Optional[Dict[str, Any]] = None, keep_backup: bool = False) -> CourseDomain:
        pass

    @abstractmethod
    async def create_course(self, fields: Dict[str, Any]) -> CourseDomain:
        """`fields["template"]`: "trong" (default), "co-ban", "chu-de"."""

    @abstractmethod
    async def duplicate_course(self, slug: str, new_slug: str, title: Optional[str] = None) -> CourseDomain:
        pass

    @abstractmethod
    async def update_course(self, slug: str, fields: Dict[str, Any], expect_rev: Optional[str] = None) -> CourseDomain:
        pass

    @abstractmethod
    async def delete_course(self, slug: str) -> None:
        """Moves the course to the trash (restorable for 30 days)."""

    @abstractmethod
    async def replace_structure(self, slug: str, sections: List[CourseSectionDomain],
                                expect_rev: Optional[str] = None) -> CourseDomain:
        pass

    @abstractmethod
    async def upsert_doc(self, slug: str, doc_id: str, fields: Dict[str, Any], expect_rev: Optional[str] = None,
                         create_only: bool = False) -> CourseDocDomain:
        pass

    @abstractmethod
    async def delete_doc(self, slug: str, doc_id: str) -> None:
        pass

    @abstractmethod
    async def rename_doc(self, slug: str, doc_id: str, new_id: str) -> CourseDocDomain:
        pass

    @abstractmethod
    async def revisions(self, slug: str, doc_id: str) -> List[CourseRevisionDomain]:
        pass

    @abstractmethod
    async def get_revision(self, slug: str, rev_id: int) -> CourseRevisionDomain:
        pass

    @abstractmethod
    async def trash(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def restore_course(self, trash_id: int, slug: Optional[str] = None) -> CourseDomain:
        pass

    @abstractmethod
    async def purge_course(self, trash_id: int) -> None:
        pass

    @abstractmethod
    async def restore_doc(self, slug: str, rev_id: int) -> CourseDocDomain:
        pass

    @abstractmethod
    async def list_assets(self, slug: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def put_asset(self, slug: str, filename: str, data: bytes) -> CourseAssetDomain:
        pass

    @abstractmethod
    async def get_asset(self, slug: str, name: str, include_unpublished: bool = False) -> CourseAssetDomain:
        pass

    @abstractmethod
    async def delete_asset(self, slug: str, name: str) -> None:
        pass
