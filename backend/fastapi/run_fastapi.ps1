# Run FastAPI from repository root (PowerShell helper)
# Usage: from repo root: .\backend\fastapi\run_fastapi.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
if (-Not (Test-Path $venvPython)) {
    Write-Host "Virtualenv python not found at $venvPython. Using system python." -ForegroundColor Yellow
    $venvPython = "python"
}
# Export PYTHONPATH so import 'src' resolves
$env:PYTHONPATH = Join-Path $root ""
& $venvPython -m uvicorn src.main:app --reload --port 6789 --host 0.0.0.0
