#!/bin/bash
# Setup test database
# This script ensures the database is ready for tests

set -e

echo "Setting up test database..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default DATABASE_URL if not set
DATABASE_URL=${DATABASE_URL:-"postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev"}

echo "Database URL: $DATABASE_URL"

# Check if database is accessible
echo "Checking database connection..."
if ! pnpm prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Database is not accessible. Please start the database with:"
  echo "   docker compose up -d postgres"
  echo "   or ensure Postgres is running on localhost:5432"
  exit 1
fi

echo "✅ Database connection successful"

# Run migrations
echo "Running migrations..."
pnpm prisma migrate deploy

echo "✅ Migrations applied"

# Generate Prisma client
echo "Generating Prisma client..."
pnpm prisma generate

echo "✅ Prisma client generated"

echo ""
echo "🎉 Test database setup complete!"
echo ""
echo "You can now run tests with:"
echo "  pnpm test"
