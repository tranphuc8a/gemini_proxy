# Create and activate a Python virtual environment for the FastAPI backend
# Usage (PowerShell):
#   .\create_venv.ps1

param(
    [string] $venvPath = ".venv"
)

Write-Host "Creating virtual environment at: $venvPath"
python -m venv $venvPath

Write-Host "Activating virtual environment"
# Activation script for PowerShell
$activate = Join-Path $venvPath 'Scripts\Activate.ps1'
if (Test-Path $activate) {
    & $activate
} else {
    Write-Host "Activation script not found. Please activate manually: $venvPath\\Scripts\\Activate.ps1"
}

Write-Host "Upgrading pip and installing requirements (if requirements.txt exists)"
python -m pip install --upgrade pip
$req = Join-Path (Get-Location) 'requirements.txt'
if (Test-Path $req) {
    pip install -r $req
} else {
    Write-Host "requirements.txt not found in current directory. Skipping install."
}

Write-Host "Done. Use '.\\$venvPath\\Scripts\\Activate.ps1' to activate the venv in new shells."
