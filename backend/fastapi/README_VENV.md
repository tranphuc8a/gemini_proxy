# Quick: create Python virtual environment for FastAPI

From PowerShell in `backend/fastapi` run:

```powershell
# create venv, activate and install requirements
.\create_venv.ps1

# or manual steps
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The project .gitignore already excludes `backend/fastapi/.venv/` and common test/IDE artifacts.
