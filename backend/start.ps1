# Start Floor Plan Generation Backend
# Run this script to start the FastAPI server

Write-Host "🏗️  Floor Plan Generation API - Starting..." -ForegroundColor Cyan

# Navigate to backend directory
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

# Check if venv exists
$venvPath = Join-Path $backendDir "venv"
if (Test-Path $venvPath) {
    Write-Host "✅ Using virtual environment" -ForegroundColor Green
    $pythonExe = Join-Path $venvPath "Scripts\python.exe"
    $pipExe = Join-Path $venvPath "Scripts\pip.exe"
} else {
    Write-Host "⚠️  No virtual environment found. Creating one..." -ForegroundColor Yellow
    python -m venv venv
    $pythonExe = Join-Path $venvPath "Scripts\python.exe"
    $pipExe = Join-Path $venvPath "Scripts\pip.exe"
    
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    & $pipExe install torch --index-url https://download.pytorch.org/whl/cpu
    & $pipExe install -r requirements.txt
}

Write-Host ""
Write-Host "🚀 Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
Write-Host "📖 API docs available at http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""

# Start the server using venv Python
& $pythonExe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
