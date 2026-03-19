#!/bin/bash

# Quick fix script for server database issues
# Run this on your server to apply missing migrations

set -e

echo "=========================================="
echo "🔧 Sochatoa API - Database Fix"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo -e "${GREEN}📄 Loading environment variables from .env${NC}"
    export $(grep -v '^#' .env | xargs)
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL is not set${NC}"
    echo "Please set DATABASE_URL environment variable or create .env file"
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
echo ""

# Step 1: Generate Prisma Client
echo -e "${YELLOW}Step 1/3: Generating Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma Client generated${NC}"
echo ""

# Step 2: Apply migrations
echo -e "${YELLOW}Step 2/3: Applying database migrations...${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✅ Migrations applied successfully${NC}"
echo ""

# Step 3: Verify tables
echo -e "${YELLOW}Step 3/3: Verifying database tables...${NC}"
TABLE_COUNT=$(npx prisma db execute --stdin <<EOF | grep -c "public" || echo "0"
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
EOF
)

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Database has $TABLE_COUNT tables${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify table count${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}✅ Database fix completed!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Restart your application: pm2 restart sochatoa-api (or your process manager)"
echo "2. Check logs: pm2 logs sochatoa-api"
echo "3. Verify tables: npm run db:log-tables"
echo ""
