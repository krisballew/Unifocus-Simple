#!/bin/bash
# Reset database (drop and recreate)

echo "⚠️  WARNING: This will delete all data in the database!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo "Resetting database..."

# Load environment variables
export $(grep -v '^#' .env.example | xargs)

# Stop and remove containers
docker-compose down -v

# Start services again
docker-compose up -d

echo "Waiting for database to be ready..."
sleep 5

echo "✅ Database reset complete"
echo "Run 'pnpm db:migrate' to apply migrations"
