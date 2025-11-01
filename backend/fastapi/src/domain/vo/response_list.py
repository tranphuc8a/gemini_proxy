from typing import Generic, List, Optional, TypeVar
from pydantic.generics import GenericModel

T = TypeVar("T")


class ResponseList(GenericModel, Generic[T]):
    data: List[T]
    first_id: Optional[str]
    last_id: Optional[str]
    has_more: bool
