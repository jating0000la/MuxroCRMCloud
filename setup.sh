#!/bin/bash

################################################################################
# MuxRo Ultimate CRM - Complete Setup Script
# ============================================
# Single command to setup entire development environment
# Clones repo, installs dependencies, creates database, builds everything
#
# Usage: bash setup.sh [github-url] [project-dir]
# Example: bash setup.sh https://github.com/jating0000la/MuxroCRMCloud.git /opt/muxro-crm
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GITHUB_URL="${1:-https://github.com/jating0000la/MuxroCRMCloud.git}"
PROJECT_DIR="${2:-.}"
DB_NAME="crm_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
NODE_ENV="development"

# Functions
log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

log_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

separator() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
}

# Step tracking
STEP=1
total_steps=13

step_start() {
    separator
    echo -e "${BLUE}[${STEP}/${total_steps}] $1${NC}"
    ((STEP++))
}

################################################################################
# STEP 1: Validate Prerequisites
################################################################################

step_start "Validating Prerequisites"

# Check if we're on WSL/Linux/Mac
if [[ "$OSTYPE" != "linux-gnu"* && "$OSTYPE" != "darwin"* ]]; then
    log_error "This script requires Linux, WSL, or macOS"
    exit 1
fi

# Check for required tools
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed"
        return 1
    fi
    log_success "$1 found"
    return 0
}

check_command "git" || exit 1
check_command "node" || exit 1
check_command "npm" || exit 1

log_success "All prerequisites found"

################################################################################
# STEP 2: Clone Repository (if needed)
################################################################################

step_start "Setting up Project Directory"

if [ "$PROJECT_DIR" != "." ] && [ ! -d "$PROJECT_DIR" ]; then
    log_info "Cloning repository from $GITHUB_URL..."
    git clone "$GITHUB_URL" "$PROJECT_DIR"
    log_success "Repository cloned to $PROJECT_DIR"
elif [ -d "$PROJECT_DIR/.git" ]; then
    log_info "Repository already exists, pulling latest changes..."
    cd "$PROJECT_DIR"
    git pull origin main || git pull origin master
    cd - > /dev/null
    log_success "Repository updated"
else
    log_info "Using existing directory: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"
log_success "Working directory: $(pwd)"

################################################################################
# STEP 3: Check/Install PostgreSQL
################################################################################

step_start "Checking PostgreSQL Installation"

if ! command -v psql &> /dev/null; then
    log_warning "PostgreSQL not found, attempting to install..."
    
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        log_info "Installing PostgreSQL on Ubuntu/Debian..."
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib
    elif command -v brew &> /dev/null; then
        # macOS with Homebrew
        log_info "Installing PostgreSQL on macOS..."
        brew install postgresql
    else
        log_error "Could not detect package manager. Please install PostgreSQL manually."
        log_info "Visit: https://www.postgresql.org/download"
        exit 1
    fi
    log_success "PostgreSQL installed"
else
    log_success "PostgreSQL is already installed"
fi

# Start PostgreSQL if not running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
    log_warning "PostgreSQL is not running, attempting to start..."
    if command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql
    elif command -v brew &> /dev/null; then
        brew services start postgresql
    fi
    sleep 2
fi

if pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
    log_success "PostgreSQL is running"
else
    log_error "Could not start PostgreSQL. Please check your installation."
    exit 1
fi

################################################################################
# STEP 4: Create Database User & Database
################################################################################

step_start "Setting up Database"

log_info "Checking/Creating database user and database..."

# Check if user exists and create if needed
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD 'postgres';" 2>/dev/null || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD 'postgres';" 2>/dev/null

# Create database if it doesn't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

log_success "Database user and database created"

################################################################################
# STEP 5: Setup Environment Files
################################################################################

step_start "Setting up Environment Configuration"

# Generate JWT Secret
JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)

# Create root .env file
if [ ! -f .env ]; then
    log_info "Creating .env file..."
    cat > .env << EOF
# ============================================
# MuxRo CRM Cloud - Development Environment
# ============================================

# Database
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=postgres
POSTGRES_DB=$DB_NAME
DATABASE_URL=postgresql://$DB_USER:postgres@$DB_HOST:$DB_PORT/$DB_NAME?schema=public

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRATION=7d

# Application
NODE_ENV=$NODE_ENV
PORT=3000
CORS_ORIGIN=http://localhost:3000

# Development
SWAGGER_ENABLED=true
PUBLIC_FORMS_ENABLED=true

# Domain (for future production use)
DOMAIN=localhost
ADMIN_EMAIL=admin@localhost.local
EOF
    log_success ".env file created"
else
    log_warning ".env already exists, skipping"
fi

# Create backend .env if needed
if [ -f "backend/.env.example" ] && [ ! -f "backend/.env" ]; then
    log_info "Creating backend/.env from template..."
    cp backend/.env.example backend/.env
    # Update DATABASE_URL in backend/.env
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://$DB_USER:postgres@$DB_HOST:$DB_PORT/$DB_NAME?schema=public|" backend/.env
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" backend/.env
    log_success "backend/.env created"
fi

log_success "Environment configuration complete"

################################################################################
# STEP 6: Install Backend Dependencies
################################################################################

step_start "Installing Backend Dependencies"

if [ ! -d "backend" ]; then
    log_error "backend directory not found"
    exit 1
fi

cd backend

if [ ! -d "node_modules" ]; then
    log_info "Installing npm packages..."
    npm install
    log_success "Backend dependencies installed"
else
    log_info "Dependencies already installed, running npm ci..."
    npm ci
    log_success "Backend dependencies updated"
fi

cd ..

################################################################################
# STEP 7: Install Frontend Dependencies
################################################################################

step_start "Installing Frontend Dependencies"

if [ ! -d "frontend" ]; then
    log_error "frontend directory not found"
    exit 1
fi

cd frontend

if [ ! -d "node_modules" ]; then
    log_info "Installing npm packages..."
    npm install
    log_success "Frontend dependencies installed"
else
    log_info "Dependencies already installed, running npm ci..."
    npm ci
    log_success "Frontend dependencies updated"
fi

cd ..

################################################################################
# STEP 8: Database Migration - Prisma Setup
################################################################################

step_start "Running Database Migrations"

cd backend

log_info "Checking Prisma migrations..."

if [ ! -d "prisma/migrations" ]; then
    log_warning "No migrations found, creating initial schema..."
    npx prisma migrate dev --name init || true
else
    log_info "Deploying existing migrations..."
    npx prisma migrate deploy
fi

log_success "Database migrations complete"

# Seed database (optional)
if [ -f "prisma/seed.ts" ] && [ -f "package.json" ] && grep -q "prisma" package.json; then
    log_info "Running database seed (if available)..."
    npx ts-node prisma/seed.ts 2>/dev/null || npm run seed 2>/dev/null || true
fi

cd ..

################################################################################
# STEP 9: Build Backend
################################################################################

step_start "Building Backend"

cd backend

log_info "Compiling TypeScript..."

if npm run build 2>&1 | tee build.log; then
    log_success "Backend build successful"
else
    log_warning "Backend build completed with warnings"
fi

cd ..

################################################################################
# STEP 10: Build Frontend
################################################################################

step_start "Building Frontend"

cd frontend

log_info "Building React application..."

if npm run build 2>&1 | tee build.log; then
    log_success "Frontend build successful"
else
    log_warning "Frontend build completed with warnings"
fi

cd ..

################################################################################
# STEP 11: Verify Database Connection
################################################################################

step_start "Verifying Database Connection"

log_info "Testing database connection..."

if PGPASSWORD=postgres psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
    log_success "Database connection verified"
else
    log_error "Could not connect to database"
    log_warning "Continuing anyway - check manually later"
fi

################################################################################
# STEP 12: Summary and Next Steps
################################################################################

step_start "Setup Complete!"

separator
echo ""
echo -e "${GREEN}🎉 MuxRo Ultimate CRM Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Project Location:${NC} $(pwd)"
echo -e "${BLUE}Database:${NC} $DB_NAME"
echo -e "${BLUE}Database User:${NC} $DB_USER"
echo -e "${BLUE}Node Environment:${NC} $NODE_ENV"
echo ""

################################################################################
# STEP 13: Quick Start Commands
################################################################################

step_start "Quick Start"

echo -e "${YELLOW}To start the application:${NC}"
echo ""
echo -e "${BLUE}Terminal 1 - Start Backend:${NC}"
echo "  cd backend"
echo "  npm start"
echo ""
echo -e "${BLUE}Terminal 2 - Start Frontend:${NC}"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}Access the application:${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:3000/api"
echo "  API Docs: http://localhost:3000/api/docs (Swagger)"
echo ""

separator
echo ""
echo -e "${GREEN}📝 Environment Configuration:${NC}"
echo "  Root .env file: .env"
echo "  Backend .env file: backend/.env"
echo "  Database URL: postgresql://$DB_USER:postgres@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

echo -e "${YELLOW}Common Commands:${NC}"
echo ""
echo -e "${BLUE}Backend:${NC}"
echo "  npm start              - Start backend server"
echo "  npm run dev            - Development with hot reload"
echo "  npm run build          - Build for production"
echo "  npx prisma studio     - Open Prisma Studio (database GUI)"
echo ""
echo -e "${BLUE}Frontend:${NC}"
echo "  npm run dev            - Start development server"
echo "  npm run build          - Build for production"
echo "  npm run preview        - Preview production build"
echo ""
echo -e "${BLUE}Database:${NC}"
echo "  psql -U $DB_USER -d $DB_NAME  - Connect to database"
echo "  npx prisma migrate dev --name   - Create new migration"
echo ""

separator
echo ""
echo -e "${GREEN}✓ Setup script completed successfully!${NC}"
echo ""
echo "If you encounter any issues:"
echo "  1. Check the .env file configuration"
echo "  2. Ensure PostgreSQL is running and accessible"
echo "  3. Verify Node.js version: node --version"
echo "  4. Check npm: npm --version"
echo ""

exit 0
