# ============================================
# MuxRo Ultimate CRM - Complete Setup Script (Windows PowerShell)
# ============================================
# Single command to setup entire development environment
# Clones repo, installs dependencies, creates database, builds everything
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1 -GitHubUrl "https://github.com/user/repo.git" -ProjectDir "C:\path\to\project"
# Or: .\setup.ps1

param(
    [string]$GitHubUrl = "https://github.com/user/repo.git",
    [string]$ProjectDir = ".",
    [string]$DbName = "crm_db",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$NodeEnv = "development"
)

# ============================================
# Configuration & Functions
# ============================================

$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Separator {
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

$Step = 1
$TotalSteps = 13

function Start-Step {
    param([string]$Title)
    Write-Separator
    Write-Host "[$Step/$TotalSteps] $Title" -ForegroundColor Cyan
    $global:Step++
}

# ============================================
# STEP 1: Validate Prerequisites
# ============================================

Start-Step "Validating Prerequisites"

$requiredTools = @("git", "node", "npm")
$missingTools = @()

foreach ($tool in $requiredTools) {
    try {
        $null = & $tool --version 2>$null
        Write-Success "$tool found"
    }
    catch {
        Write-Error "$tool is not installed"
        $missingTools += $tool
    }
}

if ($missingTools.Count -gt 0) {
    Write-Error "Missing tools: $($missingTools -join ', ')"
    Write-Info "Please install the required tools:"
    Write-Info "- Git: https://git-scm.com/download/win"
    Write-Info "- Node.js: https://nodejs.org"
    exit 1
}

Write-Success "All prerequisites found"

# ============================================
# STEP 2: Setup Project Directory
# ============================================

Start-Step "Setting up Project Directory"

$FullProjectPath = (Resolve-Path $ProjectDir -ErrorAction SilentlyContinue).Path

if ($ProjectDir -ne "." -and !(Test-Path $ProjectDir)) {
    Write-Info "Cloning repository from $GitHubUrl..."
    & git clone $GitHubUrl $ProjectDir
    Write-Success "Repository cloned to $ProjectDir"
    $FullProjectPath = (Resolve-Path $ProjectDir).Path
}
elseif (Test-Path "$ProjectDir\.git") {
    Write-Info "Repository already exists, pulling latest changes..."
    Push-Location $ProjectDir
    & git pull origin main 2>$null
    if ($LASTEXITCODE -ne 0) {
        & git pull origin master 2>$null
    }
    Pop-Location
    Write-Success "Repository updated"
}
else {
    Write-Info "Using existing directory: $ProjectDir"
}

Set-Location $FullProjectPath
Write-Success "Working directory: $((Get-Location).Path)"

# ============================================
# STEP 3: Check PostgreSQL Installation
# ============================================

Start-Step "Checking PostgreSQL Installation"

$psqlExists = $null -ne (Get-Command psql -ErrorAction SilentlyContinue)

if (-not $psqlExists) {
    Write-Warning "PostgreSQL not found on PATH"
    Write-Info "Please install PostgreSQL from: https://www.postgresql.org/download/windows"
    Write-Info "Make sure to add it to system PATH during installation"
    
    # Try to locate PostgreSQL
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\15\bin",
        "C:\Program Files\PostgreSQL\14\bin",
        "C:\Program Files (x86)\PostgreSQL\15\bin"
    )
    
    foreach ($path in $pgPaths) {
        if (Test-Path $path) {
            Write-Info "Found PostgreSQL at: $path"
            $env:Path += ";$path"
            $psqlExists = $true
            break
        }
    }
}

if ($psqlExists) {
    Write-Success "PostgreSQL is available"
}
else {
    Write-Error "PostgreSQL is required but not found"
    Write-Info "Install from: https://www.postgresql.org/download/windows"
    exit 1
}

# ============================================
# STEP 4: Create Database User & Database
# ============================================

Start-Step "Setting up Database"

Write-Info "Checking/Creating database user and database..."

$connString = "postgresql://postgres:postgres@$DbHost`:$DbPort/postgres"
$dbConnString = "postgresql://$DbUser`:$DbPassword@$DbHost`:$DbPort/$DbName"

try {
    # Create database
    Write-Info "Creating database '$DbName'..."
    & psql -h $DbHost -U postgres -c "CREATE DATABASE $DbName;" 2>$null
    
    # Grant privileges
    & psql -h $DbHost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO postgres;" 2>$null
    
    Write-Success "Database created"
}
catch {
    # Database might already exist
    Write-Warning "Could not create database (may already exist)"
}

# Test connection
$canConnect = $false
try {
    $env:PGPASSWORD = "postgres"
    & psql -h $DbHost -U postgres -d $DbName -c "SELECT 1" 2>$null
    if ($LASTEXITCODE -eq 0) {
        $canConnect = $true
    }
}
catch {
    $canConnect = $false
}

if ($canConnect) {
    Write-Success "Database connection verified"
}
else {
    Write-Warning "Could not verify database connection - continuing anyway"
}

# ============================================
# STEP 5: Setup Environment Files
# ============================================

Start-Step "Setting up Environment Configuration"

# Generate JWT Secret
$jwtSecret = ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()))).Substring(0, 48)

# Create root .env file
if (!(Test-Path ".env")) {
    Write-Info "Creating .env file..."
    $envContent = @"
# ============================================
# MuxRo CRM Cloud - Development Environment
# ============================================

# Database
POSTGRES_USER=$DbUser
POSTGRES_PASSWORD=$DbPassword
POSTGRES_DB=$DbName
DATABASE_URL=postgresql://$DbUser`:$DbPassword@$DbHost`:$DbPort/$DbName?schema=public

# JWT
JWT_SECRET=$jwtSecret
JWT_EXPIRATION=7d

# Application
NODE_ENV=$NodeEnv
PORT=3000
CORS_ORIGIN=http://localhost:3000

# Development
SWAGGER_ENABLED=true
PUBLIC_FORMS_ENABLED=true

# Domain
DOMAIN=localhost
ADMIN_EMAIL=admin@localhost.local
"@
    Set-Content -Path ".env" -Value $envContent
    Write-Success ".env file created"
}
else {
    Write-Warning ".env already exists, skipping"
}

# Create backend .env
if ((Test-Path "backend\.env.example") -and !(Test-Path "backend\.env")) {
    Write-Info "Creating backend\.env from template..."
    Copy-Item "backend\.env.example" "backend\.env"
    
    # Update values
    (Get-Content "backend\.env") -replace 'DATABASE_URL=.*', "DATABASE_URL=postgresql://$DbUser`:$DbPassword@$DbHost`:$DbPort/$DbName?schema=public" | Set-Content "backend\.env"
    (Get-Content "backend\.env") -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret" | Set-Content "backend\.env"
    
    Write-Success "backend\.env created"
}

Write-Success "Environment configuration complete"

# ============================================
# STEP 6: Install Backend Dependencies
# ============================================

Start-Step "Installing Backend Dependencies"

if (!(Test-Path "backend")) {
    Write-Error "backend directory not found"
    exit 1
}

Push-Location "backend"

if (!(Test-Path "node_modules")) {
    Write-Info "Installing npm packages..."
    & npm install
    Write-Success "Backend dependencies installed"
}
else {
    Write-Info "Dependencies already installed, running npm ci..."
    & npm ci
    Write-Success "Backend dependencies updated"
}

Pop-Location

# ============================================
# STEP 7: Install Frontend Dependencies
# ============================================

Start-Step "Installing Frontend Dependencies"

if (!(Test-Path "frontend")) {
    Write-Error "frontend directory not found"
    exit 1
}

Push-Location "frontend"

if (!(Test-Path "node_modules")) {
    Write-Info "Installing npm packages..."
    & npm install
    Write-Success "Frontend dependencies installed"
}
else {
    Write-Info "Dependencies already installed, running npm ci..."
    & npm ci
    Write-Success "Frontend dependencies updated"
}

Pop-Location

# ============================================
# STEP 8: Database Migration
# ============================================

Start-Step "Running Database Migrations"

Push-Location "backend"

Write-Info "Checking Prisma migrations..."

if (!(Test-Path "prisma\migrations")) {
    Write-Warning "No migrations found, initializing schema..."
    & npx prisma migrate dev --name init 2>$null
}
else {
    Write-Info "Deploying existing migrations..."
    & npx prisma migrate deploy
}

Write-Success "Database migrations complete"

Pop-Location

# ============================================
# STEP 9: Build Backend
# ============================================

Start-Step "Building Backend"

Push-Location "backend"

Write-Info "Compiling TypeScript..."

& npm run build 2>&1 | Tee-Object -Variable buildOutput
Write-Success "Backend build completed"

Pop-Location

# ============================================
# STEP 10: Build Frontend
# ============================================

Start-Step "Building Frontend"

Push-Location "frontend"

Write-Info "Building React application..."

& npm run build 2>&1 | Tee-Object -Variable buildOutput
Write-Success "Frontend build completed"

Pop-Location

# ============================================
# STEP 11: Verify Database Connection
# ============================================

Start-Step "Verifying Database Connection"

Write-Info "Testing database connection..."

try {
    $env:PGPASSWORD = $DbPassword
    & psql -h $DbHost -U $DbUser -d $DbName -c "SELECT 1" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database connection verified"
    }
}
catch {
    Write-Warning "Could not verify database connection"
}

# ============================================
# STEP 12: Summary
# ============================================

Start-Step "Setup Complete!"

Write-Separator
Write-Host "🎉 MuxRo Ultimate CRM Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Project Location: $((Get-Location).Path)" -ForegroundColor Cyan
Write-Host "Database: $DbName" -ForegroundColor Cyan
Write-Host "Database User: $DbUser" -ForegroundColor Cyan
Write-Host "Node Environment: $NodeEnv" -ForegroundColor Cyan
Write-Host ""

# ============================================
# STEP 13: Quick Start
# ============================================

Start-Step "Quick Start"

Write-Host "To start the application:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Terminal 1 - Start Backend:" -ForegroundColor Cyan
Write-Host "  cd backend"
Write-Host "  npm start"
Write-Host ""
Write-Host "Terminal 2 - Start Frontend:" -ForegroundColor Cyan
Write-Host "  cd frontend"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Access the application:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000"
Write-Host "  Backend API: http://localhost:3000/api"
Write-Host "  API Docs: http://localhost:3000/api/docs (Swagger)"
Write-Host ""

Write-Separator
Write-Host ""
Write-Host "📝 Environment Configuration:" -ForegroundColor Green
Write-Host "  Root .env file: .env"
Write-Host "  Backend .env file: backend\.env"
Write-Host "  Database URL: postgresql://$DbUser`:$DbPassword@$DbHost`:$DbPort/$DbName"
Write-Host ""

Write-Host "Common Commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend:" -ForegroundColor Cyan
Write-Host "  npm start              - Start backend server"
Write-Host "  npm run dev            - Development with hot reload"
Write-Host "  npm run build          - Build for production"
Write-Host "  npx prisma studio     - Open Prisma Studio (database GUI)"
Write-Host ""
Write-Host "Frontend:" -ForegroundColor Cyan
Write-Host "  npm run dev            - Start development server"
Write-Host "  npm run build          - Build for production"
Write-Host "  npm run preview        - Preview production build"
Write-Host ""
Write-Host "Database:" -ForegroundColor Cyan
Write-Host "  psql -U $DbUser -d $DbName  - Connect to database"
Write-Host "  npx prisma migrate dev --name   - Create new migration"
Write-Host ""

Write-Separator
Write-Host ""
Write-Host "✓ Setup script completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "If you encounter any issues:" -ForegroundColor Yellow
Write-Host "  1. Check the .env file configuration"
Write-Host "  2. Ensure PostgreSQL is running and accessible"
Write-Host "  3. Verify Node.js version: node --version"
Write-Host "  4. Check npm: npm --version"
Write-Host ""

exit 0
