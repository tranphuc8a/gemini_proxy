from fastapi import FastAPI
from src.adapter.controllers import conversation_controller, health_controller
from backend.fastapi.src.application.config.config import settings

app = FastAPI(title="gemini-proxy-fastapi")

# include routers under a API prefix
app.include_router(conversation_controller.router, prefix="/api/v1")
app.include_router(health_controller.router, prefix="/api/v1")
# also expose health at root for backward compatibility (/health and /health/ready)
app.include_router(health_controller.router)


@app.on_event("startup")
def startup():
    # initialize DB tables on application startup (not at import time)
    try:
        from src.adapter.db.base import init_db

        init_db()
    except Exception:
        # don't fail startup in tests if DB is not available; errors will surface on DB usage
        pass
