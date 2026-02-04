#!/bin/bash
# Test helper script to validate test readiness
# This script checks if the environment is ready to run integration tests

set -e

echo "🔍 Integration Test Environment Check"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "tests" ]; then
  echo "❌ Please run this script from services/api directory"
  exit 1
fi

echo "✅ In correct directory"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set, using default: postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev"
  export DATABASE_URL="postgresql://unifocus:unifocus_dev_password@localhost:5432/unifocus_dev"
fi

echo "✅ Database URL configured"

# Try to check database connection
echo ""
echo "Checking database connection..."
if ! pnpm prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Cannot connect to database at $DATABASE_URL"
  echo ""
  echo "Please start the database:"
  echo "  docker compose up -d postgres"
  echo ""
  echo "Or if using local PostgreSQL:"
  echo "  sudo service postgresql start"
  echo ""
  echo "Then apply migrations:"
  echo "  pnpm db:migrate:dev"
  exit 1
fi

echo "✅ Database connection successful"

# Check if migrations are applied
echo ""
echo "Checking migrations..."
MIGRATION_COUNT=$(pnpm prisma migrate status 2>&1 | grep -c "Migrations to apply" || true)
if [ "$MIGRATION_COUNT" -gt 0 ]; then
  echo "⚠️  Pending migrations found"
  echo ""
  echo "Apply migrations with:"
  echo "  pnpm db:migrate:dev"
  exit 1
fi

echo "✅ All migrations applied"

# Check if Prisma client is generated
echo ""
echo "Checking Prisma client..."
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "⚠️  Prisma client not generated"
  echo ""
  echo "Generate with:"
  echo "  pnpm prisma:generate"
  exit 1
fi

echo "✅ Prisma client generated"

echo ""
echo "🎉 Environment is ready for tests!"
echo ""
echo "Run tests with:"
echo "  pnpm test"
echo ""
echo "Or run specific test:"
echo "  pnpm test tests/idempotency.test.ts"
