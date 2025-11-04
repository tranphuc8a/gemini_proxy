try:
    from pydantic_settings import BaseSettings
except Exception:
    from pydantic import BaseSettings


class Settings(BaseSettings): # type: ignore
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_DATABASE: str = "gemini_proxy_db"
    DB_USERNAME: str = "root"
    DB_PASSWORD: str = ""

    # App
    APP_PORT: int = 6789
    API_PREFIX: str = "/api/v1"
    JWT_SECRET: str | None = None
    
    # Gemini API
    GEMINI_URL: str | None = None
    GEMINI_API_KEY: str | None = None
    GEMINI_TIMEOUT_SECONDS: int = 300
    
    # Testing
    TESTING: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
