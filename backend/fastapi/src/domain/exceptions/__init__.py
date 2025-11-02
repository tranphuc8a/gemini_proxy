"""Domain-specific exceptions package.

Expose exception types and a helper to register FastAPI handlers in `main`.
"""

from .exceptions import (
    BaseDomainException,
    ValidationError,
    UserInputError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    PersistenceError,
    ExternalServiceError,
    GeminiError,
    GeminiTimeoutError,
    SystemError,
)

from .handlers import register_exception_handlers

__all__ = [
    "BaseDomainException",
    "ValidationError",
    "UserInputError",
    "NotFoundError",
    "AuthenticationError",
    "AuthorizationError",
    "ConflictError",
    "PersistenceError",
    "ExternalServiceError",
    "GeminiError",
    "GeminiTimeoutError",
    "SystemError",
    "register_exception_handlers",
]
