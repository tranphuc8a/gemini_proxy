from typing import Any


class AppException(Exception):
    """Base application exception with a status code and optional payload."""

    def __init__(self, message: str = "Application error", status_code: int = 500, code: str | None = None, payload: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.payload = payload


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", payload: Any = None):
        super().__init__(message=message, status_code=404, code="not_found", payload=payload)


class BadRequestError(AppException):
    def __init__(self, message: str = "Bad request", payload: Any = None):
        super().__init__(message=message, status_code=400, code="bad_request", payload=payload)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Unauthorized", payload: Any = None):
        super().__init__(message=message, status_code=401, code="unauthorized", payload=payload)


class ConflictError(AppException):
    def __init__(self, message: str = "Conflict", payload: Any = None):
        super().__init__(message=message, status_code=409, code="conflict", payload=payload)


class InternalServerError(AppException):
    def __init__(self, message: str = "Internal server error", payload: Any = None):
        super().__init__(message=message, status_code=500, code="internal_error", payload=payload)


class BadGatewayError(AppException):
    def __init__(self, message: str = "Bad gateway", payload: Any = None):
        super().__init__(message=message, status_code=502, code="bad_gateway", payload=payload)


class GatewayTimeoutError(AppException):
    def __init__(self, message: str = "Gateway timeout", payload: Any = None):
        super().__init__(message=message, status_code=504, code="gateway_timeout", payload=payload)
