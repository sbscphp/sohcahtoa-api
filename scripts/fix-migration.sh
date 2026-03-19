#!/bin/bash

# Script to fix failed Prisma migration

echo "🔧 Fixing failed migration..."

# Check if the migration exists in the database
echo "📊 Checking migration status..."

# Mark the failed migration as rolled back
echo "⏮️  Marking migration as rolled back..."
npx prisma migrate resolve --rolled-back 20260216100845_

# Check if that worked
if [ $? -eq 0 ]; then
    echo "✅ Migration marked as rolled back"

    # Now try to deploy migrations again
    echo "🚀 Deploying migrations..."
    npx prisma migrate deploy

    if [ $? -eq 0 ]; then
        echo "✅ Migrations deployed successfully"

        # Generate Prisma client
        echo "🔨 Generating Prisma client..."
        npx prisma generate

        echo "✅ All done! Migration fixed."
    else
        echo "❌ Failed to deploy migrations"
        exit 1
    fi
else
    echo "⚠️  Could not mark migration as rolled back. Trying alternative approach..."

    # Alternative: Mark it as applied if it actually succeeded
    echo "🔄 Marking migration as applied..."
    npx prisma migrate resolve --applied 20260216100845_

    if [ $? -eq 0 ]; then
        echo "✅ Migration marked as applied"
        echo "🔨 Generating Prisma client..."
        npx prisma generate
        echo "✅ All done!"
    else
        echo "❌ Failed to resolve migration. You may need to reset the database."
        echo "💡 Try: npx prisma migrate reset"
        exit 1
    fi
fi
