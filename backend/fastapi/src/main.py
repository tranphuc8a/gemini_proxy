import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.adapter.input.controllers import conversation_controller, health_controller, gemini_controller, messages_controller, webapp_controller, markdown_storage_controller, sql_admin_controller, mongo_admin_controller, proxy_controller, postman_controller
from fastapi import Request
from src.application.exceptions.exceptions import AppException
from src.adapter.input.controllers.response_utils import error_response
from fastapi import HTTPException
from src.adapter.output.mysql.db.base import init_db
from src.adapter.input.admin import setup_admin
from src.adapter.factory.sql_admin_factory import shutdown_sql_admin
from src.adapter.factory.mongo_admin_factory import shutdown_mongo_admin
from src.application.config.config import settings

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
    except Exception:
        logger.exception("Database initialisation failed; continuing without it")
    yield
    # Close the connection pools the SQL administrator opened against user servers.
    await shutdown_sql_admin()
    # Same for the driver clients the MongoDB administrator opened.
    await shutdown_mongo_admin()


app = FastAPI(
    title="gemini-proxy-fastapi",
    description="A FastAPI application for the Gemini Proxy",
    version="1.0.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    lifespan=lifespan,
)

# Add CORS middleware for frontend
# Configure CORS origins from settings (supports comma-separated env value or "*")
_raw_origins = getattr(settings, "FRONTEND_ALLOWED_ORIGINS", "*") or "*"
if isinstance(_raw_origins, str) and _raw_origins.strip() == "*":
    _origins = ["*"]
else:
    _origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

admin = setup_admin(app)

# include routers under a API prefix
app.include_router(gemini_controller.router, prefix=settings.API_PREFIX)
app.include_router(conversation_controller.router, prefix=settings.API_PREFIX)
app.include_router(messages_controller.router, prefix=settings.API_PREFIX)
app.include_router(health_controller.router, prefix=settings.API_PREFIX)
app.include_router(markdown_storage_controller.router, prefix=settings.API_PREFIX)
app.include_router(sql_admin_controller.router, prefix=settings.API_PREFIX)
app.include_router(mongo_admin_controller.router, prefix=settings.API_PREFIX)
app.include_router(proxy_controller.router, prefix=settings.API_PREFIX)
app.include_router(postman_controller.router, prefix=settings.API_PREFIX)

# Mount webapp controller at root level (static content, not API)
app.include_router(webapp_controller.router)

# also expose health at root for backward compatibility (/health and /health/ready)
app.include_router(health_controller.router)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    # Custom application exceptions use our unified envelope
    return error_response(message=exc.message or "Error", status_code=exc.status_code, data=exc.payload)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """A ValueError here means the caller sent something the domain rejected.

    That is a 400, not a 404: validators raise it for over-long or malformed
    input, and answering "not found" told the client nothing useful. Repository
    lookups that genuinely miss raise NotFoundError (an AppException) instead.
    """
    return error_response(message=str(exc), status_code=400, data=None)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    # For FastAPI's HTTPException the framework normally handles it; but as a fallback wrap here
    return error_response(message=str(exc), status_code=500, data=None)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Convert FastAPI HTTPException into our unified envelope
    return error_response(message=exc.detail if hasattr(exc, "detail") else str(exc), status_code=exc.status_code, data=None)
