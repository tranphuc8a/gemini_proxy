from __future__ import annotations

from typing import Any


class BaseDomainException(Exception):
    """Base exception for domain-level errors.

    Subclasses should set `http_status` to the appropriate HTTP status code.
    """

    http_status: int = 500
    code: str = "error"

    def __init__(self, message: str | None = None, *, details: Any | None = None):
        super().__init__(message or self.__class__.__name__)
        self.message = message or self.__class__.__name__
        self.details = details

    def to_dict(self) -> dict:
        payload = {"type": self.__class__.__name__, "message": str(self.message)}
        if self.details is not None:
            payload["details"] = self.details
        return payload


class ValidationError(BaseDomainException):
    http_status = 400
    code = "validation_error"


class UserInputError(ValidationError):
    http_status = 400
    code = "user_input_error"


class NotFoundError(BaseDomainException):
    http_status = 404
    code = "not_found"


class AuthenticationError(BaseDomainException):
    http_status = 401
    code = "authentication_error"


class AuthorizationError(BaseDomainException):
    http_status = 403
    code = "authorization_error"


class ConflictError(BaseDomainException):
    http_status = 409
    code = "conflict"


class PersistenceError(BaseDomainException):
    http_status = 500
    code = "persistence_error"


class ExternalServiceError(BaseDomainException):
    http_status = 502
    code = "external_service_error"


class GeminiError(ExternalServiceError):
    http_status = 502
    code = "gemini_error"


class GeminiTimeoutError(GeminiError):
    http_status = 504
    code = "gemini_timeout"


class SystemError(BaseDomainException):
    http_status = 500
    code = "system_error"
