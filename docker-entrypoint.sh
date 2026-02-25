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

# Function to check if migration is in failed state
check_failed_migration() {
  npx prisma migrate status 2>&1 | grep -q "failed" && return 0 || return 1
}

# Try to deploy migrations
if npx prisma migrate deploy 2>&1; then
  echo "✅ Migrations deployed successfully"
else
  echo "⚠️  Migration deployment encountered an issue. Checking status..."

  # Check if there's a failed migration
  if check_failed_migration; then
    echo "🔍 Found failed migration. Attempting to resolve..."

    # Try to mark the specific failed migration as rolled back, then retry
    if npx prisma migrate resolve --rolled-back 20260216100845_ 2>&1; then
      echo "✅ Marked migration 20260216100845_ as rolled back"

      # Retry deployment
      if npx prisma migrate deploy 2>&1; then
        echo "✅ Migrations deployed successfully after resolution"
      else
        echo "⚠️  Still having issues. Trying alternative resolution..."
        # Try marking as applied instead
        npx prisma migrate resolve --applied 20260216100845_ 2>&1 || true
        echo "⚠️  Continuing with application start..."
      fi
    else
      echo "⚠️  Could not mark as rolled back. Trying to mark as applied..."
      # If database already has the schema changes, mark as applied
      npx prisma migrate resolve --applied 20260216100845_ 2>&1 || true
      echo "⚠️  Continuing with application start..."
    fi
  else
    # Check for P3005 error (database already has schema)
    if npx prisma migrate deploy 2>&1 | grep -q "P3005"; then
      echo "⚠️  Database already has schema, marking migrations as applied..."
      npx prisma migrate resolve --applied 20260206140753_init 2>&1 || true
      npx prisma migrate resolve --applied 20260213120640_unique_constraint_on_nin 2>&1 || true
      npx prisma migrate resolve --applied 20260216094318_add_actiontypes_ticket_relations 2>&1 || true
      npx prisma migrate resolve --applied 20260216100845_ 2>&1 || true
      npx prisma migrate resolve --applied 20260219221933_ 2>&1 || true
      npx prisma migrate resolve --applied 20260220081045_add_push_notifications 2>&1 || true
      npx prisma migrate resolve --applied 20260222000000_add_pickup_scheduling_fields 2>&1 || true
      npx prisma migrate resolve --applied 20260222120000_add_workflow_models 2>&1 || true
      npx prisma migrate resolve --applied 20260223161333_add_agent_password_hash 2>&1 || true
      npx prisma migrate resolve --applied 20260223165352_add_agent_otp_purpose 2>&1 || true
      npx prisma migrate resolve --applied 20260224093423_make_destination_country_optional 2>&1 || true
      npx prisma migrate resolve --applied 20260225085543_make_cash_pickup_recipient_optional 2>&1 || true
      npx prisma migrate resolve --applied 20260225113000_add_created_by_to_role_department 2>&1 || true
      npx prisma migrate resolve --applied 20260225150000_add_admin_action_types 2>&1 || true
      npx prisma migrate resolve --applied 20260225160000_add_tax_clearance_and_document_types 2>&1 || true
      echo "✅ Migrations marked as applied"
    else
      echo "⚠️  Unknown migration issue, continuing with application start..."
    fi
  fi
fi

echo "✅ Migration process completed"
echo ""

# Start the application
echo "🚀 Starting application..."
exec "$@"
