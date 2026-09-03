#!/usr/bin/env pwsh
# Markdown Editor - Quick Start Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  📝 Markdown Editor - Quick Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green

# Check if npm is installed
Write-Host "Checking npm installation..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm is not installed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ npm $npmVersion found" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Display information
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✨ Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Available commands:" -ForegroundColor Yellow
Write-Host "  npm run dev       - Start development server" -ForegroundColor Green
Write-Host "  npm run build     - Build for production" -ForegroundColor Green
Write-Host "  npm run preview   - Preview production build" -ForegroundColor Green
Write-Host "  npm run lint      - Run ESLint" -ForegroundColor Green
Write-Host "  npm run type-check - Check TypeScript types" -ForegroundColor Green
Write-Host ""

Write-Host "Quick setup:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run dev" -ForegroundColor Cyan
Write-Host "  2. Open: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  3. Click 🔐 to login as admin" -ForegroundColor Cyan
Write-Host "  4. Key: markdown-editor-admin-2024" -ForegroundColor Cyan
Write-Host ""

Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "  - README.md - User guide and features" -ForegroundColor Cyan
Write-Host "  - PROJECT_STRUCTURE.md - Architecture and design" -ForegroundColor Cyan
Write-Host "  - IMPLEMENTATION_REPORT.md - Implementation details" -ForegroundColor Cyan
Write-Host ""

Write-Host "Ready to start? Run: npm run dev" -ForegroundColor Green
Write-Host ""
