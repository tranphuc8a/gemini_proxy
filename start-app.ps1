# Start Backend (FastAPI) and Frontend (React) together

Write-Host "Starting Gemini Chat Application..." -ForegroundColor Green

# Start Backend
Write-Host "`nStarting FastAPI Backend on port 6789..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend\fastapi; python -m uvicorn src.main:app --reload --port 6789 --host 0.0.0.0"

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "`nStarting React Frontend on port 5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "`nApplication started!" -ForegroundColor Green
Write-Host "Backend: http://localhost:6789" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "`nPress any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
