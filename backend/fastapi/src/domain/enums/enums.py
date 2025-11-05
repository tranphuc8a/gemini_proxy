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
    GEMINI_2_5_PRO = "gemini-2.5-pro"
    GEMINI_2_5_FLASH = "gemini-2.5-flash"
    GEMINI_2_5_FLASH_LITE = "gemini-2.5-flash-lite"
    GEMINI_2_0_FLASH = "gemini-2.0-flash"
    GEMINI_2_0_FLASH_LITE = "gemini-2.0-flash-lite"
    GEMINI_FLASH_LATEST = "gemini-flash-latest"

    @classmethod
    def from_str(cls, value: Any) -> "EModel":
        return cast_enum(cls, value)

