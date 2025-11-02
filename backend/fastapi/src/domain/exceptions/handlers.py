from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette import status

from .exceptions import BaseDomainException

logger = logging.getLogger(__name__)


def _domain_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a JSONResponse for domain exceptions."""
    # Ensure the handler signature is compatible with FastAPI's ExceptionHandler type.
    # If the exception is not a BaseDomainException, delegate to the unexpected handler.
    if not isinstance(exc, BaseDomainException):
        return _unexpected_exception_handler(request, exc)

    payload = {"error": exc.to_dict()}
    return JSONResponse(status_code=getattr(exc, "http_status", 500), content=payload)


def _validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Match the generic ExceptionHandler signature and verify the concrete type at runtime.
    if not isinstance(exc, RequestValidationError):
        return _unexpected_exception_handler(request, exc)

    logger.debug("Request validation error: %s", exc)
    payload = {
        "error": {
            "type": "RequestValidationError",
            "message": "Invalid request parameters",
            "details": exc.errors(),
        }
    }
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=payload)


def _http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Match the generic ExceptionHandler signature and verify the concrete type at runtime.
    if not isinstance(exc, StarletteHTTPException):
        return _unexpected_exception_handler(request, exc)

    payload = {"error": {"type": "HTTPException", "message": getattr(exc, "detail", None)}}
    return JSONResponse(status_code=getattr(exc, "status_code", 500), content=payload)


def _unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Avoid leaking internal details
    logger.exception("Unexpected error during request processing: %s", exc)
    payload = {"error": {"type": "InternalServerError", "message": "An internal error occurred"}}
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=payload)


def register_exception_handlers(app: FastAPI) -> None:
    """Register default exception handlers on a FastAPI app.

    Call this from `main` after creating the FastAPI app, for example:

        from src.domain.exceptions import register_exception_handlers
        register_exception_handlers(app)

    """
    # Domain exceptions
    app.add_exception_handler(BaseDomainException, _domain_exception_handler)

    # FastAPI/Starlette specific exceptions
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)

    # Catch-all
    app.add_exception_handler(Exception, _unexpected_exception_handler)
