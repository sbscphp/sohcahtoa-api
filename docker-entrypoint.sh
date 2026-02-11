#!/bin/sh

# Docker entrypoint script for Sochatoa API
# This runs migrations before starting the application

set -e

echo "=========================================="
echo "Sochatoa API - Starting..."
echo "=========================================="

# Extract database host and port from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

# Default to standard PostgreSQL port if not found
if [ -z "$DB_PORT" ]; then
  DB_PORT=5432
fi

echo "⏳ Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

# Wait for PostgreSQL to be ready using nc (netcat)
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "✅ PostgreSQL is ready!"
    break
  fi

  attempt=$((attempt + 1))
  echo "⏳ PostgreSQL is unavailable - sleeping (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ PostgreSQL did not become ready in time"
  exit 1
fi

echo ""

# Wait for Redis to be ready
echo "⏳ Waiting for Redis..."

# Extract Redis host and port from REDIS_URL
# Format: redis://host:port
REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\([^:]*\).*/\1/p')
REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\)$/\1/p')

# Default to standard Redis port if not found
if [ -z "$REDIS_PORT" ] || [ "$REDIS_PORT" = "$REDIS_HOST" ]; then
  REDIS_PORT=6379
fi

# If REDIS_HOST is empty, extract it differently
if [ -z "$REDIS_HOST" ]; then
  REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\(.*\)/\1/p' | cut -d: -f1)
fi

max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; then
    echo "✅ Redis is ready!"
    break
  fi

  attempt=$((attempt + 1))
  echo "⏳ Redis is unavailable - sleeping (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "⚠️  Redis did not become ready in time (this is optional, continuing...)"
fi

echo ""

# Generate Prisma Client (in case it's not already generated)
echo "🔧 Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"
echo ""

# Run Prisma migrations
echo "🚀 Running database migrations..."
npx prisma migrate deploy
echo "✅ Migrations completed"
echo ""

# Start the application
echo "🚀 Starting application..."
exec "$@"
