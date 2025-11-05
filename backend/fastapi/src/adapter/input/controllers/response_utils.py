from fastapi.responses import JSONResponse
from typing import Any

from pydantic import BaseModel

def to_serializable(obj: Any):
    if isinstance(obj, BaseModel):
        return obj.model_dump()
    if isinstance(obj, list):
        return [to_serializable(o) for o in obj]
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    return obj


def success_response(data: Any = None, message: str = "OK", status_code: int = 200) -> JSONResponse:
    payload = {"status_code": status_code, "message": message, "data": to_serializable(data)}
    return JSONResponse(content=payload, status_code=status_code)


def error_response(message: str = "Error", status_code: int = 500, data: Any = None) -> JSONResponse:
    payload = {"status_code": status_code, "message": message, "data": to_serializable(data)}
    return JSONResponse(content=payload, status_code=status_code)
