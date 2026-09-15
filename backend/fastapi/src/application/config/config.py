try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except Exception:  # pragma: no cover - pydantic v1 fallback
    from pydantic import BaseSettings  # type: ignore[attr-defined]

    SettingsConfigDict = dict  # type: ignore[assignment,misc]


class Settings(BaseSettings): # type: ignore
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_DATABASE: str = "gemini_proxy_db"
    DB_USERNAME: str = "root"
    DB_PASSWORD: str = ""

    # Where JSON data files are written. Empty means "probe for a writable
    # location" (see src/application/utils/data_paths.py) -- normally ./data,
    # falling back to the system temp dir on a read-only deployment such as
    # Vercel. Set it explicitly when a volume is mounted.
    DATA_DIR: str = ""

    # App
    APP_PORT: int = 6789
    API_PREFIX: str = "/api/v1"
    JWT_SECRET: str | None = None
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "change-me"
    ADMIN_SECRET_KEY: str = "change-me-before-production"
    
    # Gemini API
    GEMINI_URL: str | None = None
    GEMINI_API_KEY: str | None = None
    GEMINI_TIMEOUT_SECONDS: int = 300
    # CORS
    # Comma-separated list of allowed origins, or '*' to allow all origins.
    # Example: "http://localhost:5173,http://127.0.0.1:5173"
    FRONTEND_ALLOWED_ORIGINS: str = "*"
    # This deployment's own MongoDB, used by the "mongo" storage backend of the
    # editor apps. Unrelated to the mongo-administrator, which connects to
    # whatever server its user logs into. Empty means the backend is unavailable.
    MONGO_URI: str = ""
    MONGO_DATABASE: str = "gemini_proxy"
    MONGO_CONNECT_TIMEOUT: int = 10

    MARKDOWN_STORAGE_BACKEND: str = "json"
    MARKDOWN_JSON_FILE: str = "data/markdown-files.json"
    MARKDOWN_ADMIN_KEY: str = "markdown-editor-admin-2024"
    # How long an unlocked browser stays unlocked. The key itself is never
    # stored client-side; what the browser keeps is a signed token that expires.
    MARKDOWN_SESSION_HOURS: int = 12

    # graphuc (/graphuc front-end): graph drawings saved server-side.
    GRAPHUC_STORAGE_BACKEND: str = "json"
    GRAPHUC_JSON_FILE: str = "data/graphuc-graphs.json"
    GRAPHUC_ADMIN_KEY: str = "graphuc-admin-2024"
    GRAPHUC_SESSION_HOURS: int = 12

    # Where the two administrators mirror their login sessions: json | mysql | mongo.
    # Sessions last until the user logs out, so the only question is whether the
    # mirror survives. "json" writes a file, which on a serverless platform sits
    # in a per-instance temp directory and is therefore lost between requests --
    # that is what made users log in again and again. Pick mysql or mongo there.
    ADMIN_SESSION_BACKEND: str = "json"

    # SQL administrator (/sql-administrator front-end)
    # Sessions are sealed with this key before being written to disk; rotating it
    # invalidates every stored login.
    SQLADMIN_SECRET_KEY: str = "change-me-sqladmin"
    SQLADMIN_SESSION_FILE: str = "data/sqladmin-sessions.json"
    SQLADMIN_PERSIST_SESSIONS: bool = True
    SQLADMIN_CONNECT_TIMEOUT: int = 10
    SQLADMIN_STATEMENT_TIMEOUT: int = 60
    SQLADMIN_POOL_SIZE: int = 5
    SQLADMIN_MAX_ROWS: int = 10000
    # MongoDB administrator (/mongo-administrator front-end)
    # Sessions are sealed with this key before being written to disk; rotating it
    # invalidates every stored login. The whole connection URI is the credential
    # here, so it is the URI that gets sealed.
    MONGOADMIN_SECRET_KEY: str = "change-me-mongoadmin"
    MONGOADMIN_SESSION_FILE: str = "data/mongoadmin-sessions.json"
    MONGOADMIN_PERSIST_SESSIONS: bool = True
    MONGOADMIN_CONNECT_TIMEOUT: int = 10
    MONGOADMIN_OPERATION_TIMEOUT: int = 60
    MONGOADMIN_POOL_SIZE: int = 10
    MONGOADMIN_MAX_DOCUMENTS: int = 1000

    # HTTP forward proxy (/proxy/request, used by the postman-lite web app)
    # A browser cannot call an API that sends no CORS headers; forwarding the
    # request server-side removes that limit. It also makes the backend reachable
    # as a forward proxy, so turn it off or pin the host list when the API is
    # exposed publicly.
    PROXY_ENABLED: bool = True
    # Comma-separated hostname patterns ("api.example.com,*.internal") or "*".
    PROXY_ALLOWED_HOSTS: str = "*"
    PROXY_TIMEOUT_SECONDS: float = 60.0
    PROXY_MAX_BYTES: int = 10 * 1024 * 1024
    # Off by default: testers routinely point the tool at boxes with self-signed
    # certificates, and refusing would make it weaker than the curl it prints.
    PROXY_VERIFY_TLS: bool = False

    # postman-lite-pro workspace sync (/postman/*)
    # "json" keeps everything in one file and needs no database, which is how
    # the tool is normally run; "mysql" creates its tables on first use.
    POSTMAN_STORAGE_BACKEND: str = "json"
    POSTMAN_JSON_FILE: str = "data/postman-workspaces.json"
    POSTMAN_MAX_HISTORY: int = 500

    
    # Testing
    TESTING: bool = False

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
