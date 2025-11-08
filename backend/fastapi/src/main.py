from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.adapter.input.controllers import conversation_controller, health_controller, gemini_controller, messages_controller, webapp_controller
from fastapi import Request
from fastapi.responses import JSONResponse
from src.application.exceptions.exceptions import AppException
from src.adapter.input.controllers.response_utils import error_response
from fastapi import HTTPException
from src.adapter.output.mysql.db.base import init_db
from src.application.config.config import settings

app = FastAPI(
    title="gemini-proxy-fastapi",
    description="A FastAPI application for the Gemini Proxy",
    version="1.0.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc"
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

# include routers under a API prefix
app.include_router(gemini_controller.router, prefix=settings.API_PREFIX)
app.include_router(conversation_controller.router, prefix=settings.API_PREFIX)
app.include_router(messages_controller.router, prefix=settings.API_PREFIX)
app.include_router(health_controller.router, prefix=settings.API_PREFIX)
app.include_router(webapp_controller.router, prefix=settings.API_PREFIX)


# also expose health at root for backward compatibility (/health and /health/ready)
app.include_router(health_controller.router)


@app.on_event("startup")
def startup():
    try:
        init_db()
    except Exception:
        pass


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    # Custom application exceptions use our unified envelope
    return error_response(message=exc.message or "Error", status_code=exc.status_code, data=exc.payload)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Map some common errors to nicer responses
    # ValueError -> 404 (conservative mapping for repository lookups that raise ValueError)
    if isinstance(exc, ValueError):
        return error_response(message=str(exc), status_code=404, data=None)
    # For FastAPI's HTTPException the framework normally handles it; but as a fallback wrap here
    return error_response(message=str(exc), status_code=500, data=None)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Convert FastAPI HTTPException into our unified envelope
    return error_response(message=exc.detail if hasattr(exc, "detail") else str(exc), status_code=exc.status_code, data=None)
