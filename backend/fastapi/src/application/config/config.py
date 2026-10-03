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
    # A full SQLAlchemy *async* URL that overrides the DB_* fields above. The
    # production database (MySQL on Aiven) is not reachable from every laptop,
    # and the course importer and the course web pages need *a* database to be
    # worked on locally: `sqlite+aiosqlite:///data/dev.sqlite3` is enough.
    DB_URL: str = ""

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

    # Course content (/courses/*): reading is public, writing (import, edit,
    # delete) needs this key — exchanged for a session token like the editors.
    # Empty (the default) switches every write endpoint off: a key printed in
    # the source would be a key every reader of the repository holds.
    COURSE_ADMIN_KEY: str = ""
    COURSE_SESSION_HOURS: int = 12
    # A session token can be refreshed before it expires, but only this many
    # days after the login that started the chain; then the key is asked again.
    COURSE_SESSION_MAX_DAYS: int = 7
    # `GET /courses/{slug}/bundle` hands the whole course to the browser in one
    # response; that is fine for a small structured course (OPIc, ~250 KB) and
    # exactly what the refactor set out to stop for an 8 MB one. Above this
    # many bytes of markdown the endpoint refuses and points at the manifest.
    COURSE_BULK_MAX_BYTES: int = 2 * 1024 * 1024
    # One lesson's markdown. Vercel refuses request bodies over 4.5 MB anyway;
    # past this limit the API says so in words instead of a bare 413.
    COURSE_DOC_MAX_BYTES: int = 1024 * 1024
    # One uploaded file (image, PDF…) of a course.
    COURSE_ASSET_MAX_BYTES: int = 3 * 1024 * 1024
    # Wrong admin keys tolerated per client address, then per server, in this
    # many seconds before /courses/admin/verify answers 429.
    COURSE_LOGIN_FAILURES: int = 5
    COURSE_LOGIN_FAILURES_GLOBAL: int = 50
    COURSE_LOGIN_WINDOW_SECONDS: int = 300

    # AI features (/ai/*: tutor, flashcards, course drafting, OPIc scoring, NL→SQL…)
    # and the chat (/gemini/*) spend the same Gemini quota (GEMINI_URL + key).
    # A kill switch: False stops every Gemini call, the chat included.
    AI_ENABLED: bool = True
    # Who may use the AI features (the chat keeps its own, public, access):
    #   "admin"  — a course administrator only (COURSE_ADMIN_KEY session); the default,
    #   "code"   — anyone who enters AI_ACCESS_CODE (exchanged for a token), and admins,
    #   "public" — anyone; the rate limits and the daily budget below still apply.
    AI_ACCESS: str = "admin"
    AI_ACCESS_CODE: str = ""
    AI_SESSION_DAYS: int = 7
    # The model the AI features ask for (it replaces the model segment of GEMINI_URL).
    AI_MODEL: str = "gemini-2.5-flash"
    AI_TIMEOUT_SECONDS: int = 90
    # Requests per client address (administrators are exempt)…
    AI_RATE_PER_MINUTE: int = 12
    AI_RATE_PER_DAY: int = 200
    # …and for the whole deployment per UTC day, counted in the database so every
    # serverless instance shares it. Once either is spent every Gemini call answers
    # 429 until midnight UTC.
    AI_DAILY_REQUESTS: int = 500
    AI_DAILY_TOKENS: int = 3_000_000


    # Testing
    TESTING: bool = False

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
