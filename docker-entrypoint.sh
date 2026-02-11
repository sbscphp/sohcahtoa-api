#!/bin/sh

# Docker entrypoint script for Sochatoa API
# This runs migrations before starting the application

set -e

echo "=========================================="
echo "Sochatoa API - Starting..."
echo "=========================================="

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect()
    .then(() => client.end())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
"; do
  echo "⏳ PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready!"
echo ""

# Run Prisma migrations
echo "🚀 Running database migrations..."
npx prisma migrate deploy
echo "✅ Migrations completed"
echo ""

# Start the application
echo "🚀 Starting application..."
exec "$@"
