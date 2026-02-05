#!/bin/bash
# Start Docker Compose services

echo "Starting development dependencies..."
docker compose up -d

echo "Waiting for services to be healthy..."
sleep 5

# Check if services are running
if docker compose ps | grep -q "Up"; then
  echo "✅ Services started successfully!"
  echo ""
  echo "📦 Available services:"
  echo "  - PostgreSQL: localhost:5432"
  echo "  - Redis: localhost:6379"
  echo ""
  echo "Run 'pnpm db:migrate' to apply database migrations"
else
  echo "❌ Failed to start services"
  exit 1
fi
