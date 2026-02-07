#!/bin/bash

# Unifocus Startup Script
# Automatically initializes and starts the full development stack
# Runs on Codespace startup and can be used manually

set -e

echo "🚀 Unifocus Development Environment Startup"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

# Step 1: Check prerequisites
log_info "Step 1: Checking prerequisites..."

if ! command -v docker &> /dev/null; then
  log_error "Docker is not installed"
  exit 1
fi

if ! command -v pnpm &> /dev/null; then
  log_error "pnpm is not installed"
  exit 1
fi

log_success "Prerequisites verified"
echo ""

# Step 2: Install dependencies
log_info "Step 2: Installing dependencies..."

if [ ! -d "node_modules" ]; then
  pnpm install
  log_success "Dependencies installed"
else
  log_success "Dependencies already installed"
fi
echo ""

# Step 3: Copy environment files if missing
log_info "Step 3: Setting up environment files..."

if [ ! -f ".env" ]; then
  log_warning ".env not found, copying from .env.example"
  cp .env.example .env
fi

if [ ! -f "services/api/.env" ]; then
  log_warning "services/api/.env not found, copying from services/api/.env.example"
  cp services/api/.env.example services/api/.env
fi

if [ ! -f "apps/web/.env" ]; then
  log_warning "apps/web/.env not found, copying from apps/web/.env.example"
  cp apps/web/.env.example apps/web/.env
fi

log_success "Environment files ready"
echo ""

# Step 4: Start Docker containers
log_info "Step 4: Starting Docker containers..."

if [ "$(docker ps -q --filter name=unifocus-postgres)" ]; then
  log_success "PostgreSQL container already running"
else
  docker-compose up -d
  log_warning "Waiting for containers to be healthy..."

  # Wait for PostgreSQL to be ready
  max_attempts=30
  attempt=1
  while [ $attempt -le $max_attempts ]; do
    if docker exec unifocus-postgres pg_isready -U unifocus > /dev/null 2>&1; then
      log_success "PostgreSQL is ready"
      break
    fi
    if [ $attempt -eq $max_attempts ]; then
      log_error "PostgreSQL failed to start after ${max_attempts}s"
      exit 1
    fi
    echo -n "."
    sleep 1
    ((attempt++))
  done
  echo ""
fi

log_success "Docker containers running"
echo ""

# Step 5: Run database migrations
log_info "Step 5: Running database migrations..."

cd services/api

if ! pnpm db:migrate > /tmp/migrations.log 2>&1; then
  log_error "Database migrations failed"
  tail -20 /tmp/migrations.log
  exit 1
fi

log_success "Database migrations completed"
cd - > /dev/null
echo ""

# Step 6: Start development servers
log_info "Step 6: Starting development servers..."
log_info "  • Web app will start on http://localhost:3000"
log_info "  • API server will start on http://localhost:3001"
echo ""

# Start servers in background
pnpm dev &

log_success "Startup complete! 🎉"
echo ""
echo -e "${GREEN}✓ Your development environment is ready!${NC}"
echo ""
echo "  Web: http://localhost:3000"
echo "  API: http://localhost:3001"
echo "  Database: postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev"
echo "  Redis: redis://localhost:6379"
echo ""
echo "TIP: Use 'pnpm dev' to start/restart servers at any time"
echo "     Use 'docker-compose down' to stop containers"
echo "     Use 'pnpm db:reset' to reset the database"
echo ""

# Wait for servers to start and show health status
sleep 5
echo "🔍 Verifying services..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  log_success "API server is responding"
else
  log_warning "API server is still starting..."
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  log_success "Web app is responding"
else
  log_warning "Web app is still starting..."
fi

echo ""
echo "You can now open http://localhost:3000 in your browser!"
