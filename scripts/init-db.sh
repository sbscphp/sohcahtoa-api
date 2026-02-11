#!/bin/bash

# Database initialization script
# This script ensures the database is properly set up with all tables

set -e

echo "=========================================="
echo "Database Initialization Script"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL environment variable is not set"
  echo "Loading from .env file..."
  export $(grep -v '^#' .env | xargs)
fi

echo "📊 Database URL: $DATABASE_URL"
echo ""

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"
echo ""

# Apply migrations
echo "🚀 Applying database migrations..."
npx prisma migrate deploy
echo "✅ Migrations applied successfully"
echo ""

# Optional: Run seed (uncomment if you want to seed data)
# echo "🌱 Seeding database..."
# npx prisma db seed
# echo "✅ Database seeded successfully"
# echo ""

echo "=========================================="
echo "✅ Database initialization complete!"
echo "=========================================="
