from fastapi import FastAPI
from src.adapter.input.controllers import conversation_controller, health_controller, gemini_controller
from src.adapter.output.mysql.db.base import init_db
from src.application.config.config import settings

app = FastAPI(
    title="gemini-proxy-fastapi",
    description="A FastAPI application for the Gemini Proxy",
    version="1.0.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc"
)

# include routers under a API prefix
app.include_router(conversation_controller.router, prefix=settings.API_PREFIX)
app.include_router(health_controller.router, prefix=settings.API_PREFIX)
app.include_router(gemini_controller.router, prefix=settings.API_PREFIX)
# also expose health at root for backward compatibility (/health and /health/ready)
app.include_router(health_controller.router)


@app.on_event("startup")
def startup():
    try:
        init_db()
    except Exception:
        pass
