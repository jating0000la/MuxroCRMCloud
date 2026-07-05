#!/bin/bash
# ============================================
# Muxro CRM Cloud - VPS Deployment Script
# ============================================
# Run this on your VPS after cloning the repo
# Usage: chmod +x deploy.sh && ./deploy.sh

set -e

echo "=== Muxro CRM Cloud - Deployment ==="
echo ""

# Step 1: Check prerequisites
echo "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install: https://docs.docker.com/engine/install/"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null 2>&1 || { echo "Docker Compose is required."; exit 1; }

# Step 2: Create .env if not exists
if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env

  # Generate random JWT_SECRET
  JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
  sed -i "s|CHANGE_THIS_TO_RANDOM_64_CHAR_STRING|$JWT_SECRET|" .env

  echo ""
  echo "IMPORTANT: Edit .env and set:"
  echo "  - POSTGRES_PASSWORD (strong password)"
  echo "  - CORS_ORIGIN (your domain)"
  echo "  - DOMAIN (your domain)"
  echo "  - ADMIN_EMAIL (your email)"
  echo ""
  echo "Press Enter after editing .env to continue..."
  read
fi

# Step 3: Build and start
echo "Building and starting services..."
docker compose build --no-cache
docker compose up -d

# Step 4: Wait for backend to be ready
echo "Waiting for backend to be ready..."
sleep 10

# Step 5: Run database migrations
echo "Running database migrations..."
docker compose exec backend npx prisma migrate deploy

# Step 6: Seed admin user
echo "Seeding admin user..."
docker compose exec backend npx ts-node prisma/seed.ts

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Services:"
echo "  - Frontend: http://localhost"
echo "  - Backend API: http://localhost/api"
echo "  - Health Check: http://localhost/api/health"
echo ""
echo "Default admin login:"
echo "  - Username: admin"
echo "  - Password: admin123"
echo ""
echo "To enable SSL, run: ./setup-ssl.sh your-domain.com your@email.com"
echo ""
