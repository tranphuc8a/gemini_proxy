#!/bin/bash
# Markdown Editor - Quick Start Script

echo "========================================"
echo "  📝 Markdown Editor - Quick Start"
echo "========================================"
echo ""

# Check if Node.js is installed
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "✓ Node.js $NODE_VERSION found"

# Check if npm is installed
echo "Checking npm installation..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo "✓ npm $NPM_VERSION found"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed successfully"
echo ""

# Display information
echo "========================================"
echo "  ✨ Setup Complete!"
echo "========================================"
echo ""

echo "Available commands:"
echo "  npm run dev       - Start development server"
echo "  npm run build     - Build for production"
echo "  npm run preview   - Preview production build"
echo "  npm run lint      - Run ESLint"
echo "  npm run type-check - Check TypeScript types"
echo ""

echo "Quick setup:"
echo "  1. Run: npm run dev"
echo "  2. Open: http://localhost:5173"
echo "  3. Click 🔐 to login as admin"
echo "  4. Key: markdown-editor-admin-2024"
echo ""

echo "Documentation:"
echo "  - README.md - User guide and features"
echo "  - PROJECT_STRUCTURE.md - Architecture and design"
echo "  - IMPLEMENTATION_REPORT.md - Implementation details"
echo ""

echo "Ready to start? Run: npm run dev"
echo ""
