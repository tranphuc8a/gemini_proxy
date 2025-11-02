from typing import Generic, TypeVar

TDomain = TypeVar("TDomain")


class AbstractEntity(Generic[TDomain]):
    @classmethod
    def from_domain(cls, domain_obj: TDomain):
        """Create an entity instance from a domain object."""
        raise NotImplementedError()

    def to_domain(self) -> TDomain:
        """Convert this entity to a domain object."""
        raise NotImplementedError()
