FastAPI backend scaffold for gemini-proxy

This folder contains a FastAPI implementation following a hexagonal architecture
to mirror the existing Java Spring Boot backend. It's a scaffold with:

- app/main.py: FastAPI app entrypoint
- app/config.py: environment configuration
- app/db/: SQLAlchemy engine and models
- app/application/: ports and usecases
- app/adapters/: controllers, repositories, gemini client

See `requirements.txt` (runtime) and `requirements-dev.txt` (tests, migrations), plus the quick start below.

Quick start (PowerShell):

```powershell
cd 'c:\Users\tranphuc8a\Desktop\gemini_proxy\backend\fastapi'
python -m venv .venv; .\.venv\Scripts\Activate.ps1
# requirements.txt is runtime only; -dev.txt adds pytest and alembic
pip install -r requirements.txt -r requirements-dev.txt
# copy and edit the example env file, then activate it
# copy .env.example to .env and set your secrets (or set env vars directly)
# cp .env.example .env  (on PowerShell: Copy-Item .env.example .env)
# then uvicorn will pick up values via pydantic BaseSettings
uvicorn app.main:app --host 0.0.0.0 --port 6789 --reload
```

Notes:
- The gemini client is a stub; integrate the real Gemini API where indicated.
- The repositories use SQLAlchemy and expect a MariaDB/MySQL-compatible URL.
- The SQLAdmin interface is available at `/admin/` and requires `ADMIN_USERNAME` and
	`ADMIN_PASSWORD` credentials. Set `ADMIN_SECRET_KEY` to a strong value outside local development.
