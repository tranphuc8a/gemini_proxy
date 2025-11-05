from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class ListResponse(BaseModel, Generic[T]):
    data: List[T]
    first_id: Optional[str]
    last_id: Optional[str]
    has_more: bool
