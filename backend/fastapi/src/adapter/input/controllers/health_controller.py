from fastapi import APIRouter, status, Depends
from fastapi.responses import JSONResponse
from backend.fastapi.src.application.config.config import settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapter.db.base import get_async_session


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", summary="Liveness probe")
def health():
    return {"status": "ok", "service": "gemini-proxy-fastapi", "port": settings.APP_PORT}


@router.get("/ready", summary="Readiness probe")
async def ready(db: AsyncSession = Depends(get_async_session)):
    """Try a lightweight DB check to determine readiness. Returns 200 when DB is reachable, 503 otherwise."""
    try:
        await db.execute(text("SELECT 1"))
        return {"ready": True}
    except Exception:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"ready": False})
