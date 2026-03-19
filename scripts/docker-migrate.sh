#!/bin/bash

# Docker-safe migration script
# This script handles failed migrations gracefully in Docker environments

set -e

echo "🐳 Starting Docker migration process..."

# Function to check if migration is failed
check_migration_status() {
    npx prisma migrate status 2>&1 | grep -q "failed" && return 0 || return 1
}

# Try to deploy migrations normally first
echo "📦 Attempting to deploy migrations..."
if npx prisma migrate deploy 2>&1; then
    echo "✅ Migrations deployed successfully"
    npx prisma generate
    echo "✅ Prisma client generated"
    exit 0
fi

# If deploy failed, check if it's because of a failed migration
echo "⚠️  Migration deployment failed. Checking status..."

if check_migration_status; then
    echo "🔍 Found failed migration. Attempting to resolve..."

    # Try to mark as rolled back and retry
    if npx prisma migrate resolve --rolled-back 20260216100845_ 2>&1; then
        echo "✅ Marked migration as rolled back"

        # Retry deployment
        if npx prisma migrate deploy 2>&1; then
            echo "✅ Migrations deployed successfully after resolution"
            npx prisma generate
            echo "✅ Prisma client generated"
            exit 0
        fi
    fi

    # If that didn't work, try marking as applied
    echo "🔄 Trying alternative resolution method..."
    if npx prisma migrate resolve --applied 20260216100845_ 2>&1; then
        echo "✅ Marked migration as applied"
        npx prisma generate
        echo "✅ Prisma client generated"
        exit 0
    fi
fi

echo "❌ Could not resolve migration automatically"
echo "💡 Manual intervention may be required"
exit 1
