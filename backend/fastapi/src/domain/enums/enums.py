from enum import Enum
from typing import Type, TypeVar, Any

T = TypeVar("T", bound=Enum)


def cast_enum(enum_cls: Type[T], value: Any) -> T:
    """Case-insensitive cast from a string (or enum) to an Enum member.

    - If `value` is already an instance of `enum_cls`, it is returned.
    - If `value` is a string, match is performed case-insensitively against
      both member names and member values.
    - Raises ValueError if no match is found.
    """
    if isinstance(value, enum_cls):
        return value

    if value is None:
        raise ValueError(f"Cannot cast None to {enum_cls.__name__}")

    s = str(value).strip().lower()
    for member in enum_cls:
        # compare both name and value (both lower-cased)
        if member.name.lower() == s or str(member.value).lower() == s:
            return member

    raise ValueError(f"Value '{value}' is not a valid {enum_cls.__name__}")


class ESortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

    @classmethod
    def from_str(cls, value: Any) -> "ESortOrder":
        return cast_enum(cls, value)


class ERole(str, Enum):
    USER = "user"
    MODEL = "model"

    @classmethod
    def from_str(cls, value: Any) -> "ERole":
        return cast_enum(cls, value)


class EModel(str, Enum):
    # A small set of example model identifiers. Add more as needed.
    GPT_4 = "gpt-4"
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_3_5_TURBO = "gpt-3.5-turbo"
    GEMINI_1_0 = "gemini-1.0"
    GEMINI_1_5 = "gemini-1.5"

    @classmethod
    def from_str(cls, value: Any) -> "EModel":
        return cast_enum(cls, value)

