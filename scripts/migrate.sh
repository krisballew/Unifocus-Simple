#!/bin/bash
# Run database migrations and ensure master admin user exists

echo "Running database migrations..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set, using default from .env.example"
  export $(grep -v '^#' .env.example | xargs)
fi

# Run Prisma migrations
cd services/api || exit 1

echo "📝 Running Prisma migrations..."
pnpm prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "❌ Migration failed"
  exit 1
fi

echo "✅ Migrations completed"

# CRITICAL: Always ensure master admin user exists
echo "🔐 Ensuring master admin user exists..."
pnpm db:ensure-admin

if [ $? -ne 0 ]; then
  echo "⚠️  Master admin ensure failed, but migrations completed"
  exit 1
fi

echo "✅ Database migrations completed and master admin ensured"
