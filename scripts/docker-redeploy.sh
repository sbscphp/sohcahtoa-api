#!/bin/bash

# Quick Docker redeploy script
# This rebuilds and restarts the entire stack

set -e

echo "=========================================="
echo "🚀 Sochatoa API - Docker Redeploy"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop containers
echo -e "${YELLOW}Step 1/4: Stopping containers...${NC}"
docker-compose down
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

# Step 2: Build new image
echo -e "${YELLOW}Step 2/4: Building new image...${NC}"
docker-compose build api
echo -e "${GREEN}✅ Image built${NC}"
echo ""

# Step 3: Start services
echo -e "${YELLOW}Step 3/4: Starting services...${NC}"
docker-compose up -d
echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 4: Show logs
echo -e "${YELLOW}Step 4/4: Checking startup logs...${NC}"
echo ""
sleep 5
docker-compose logs --tail=50 api
echo ""

echo "=========================================="
echo -e "${GREEN}✅ Redeploy completed!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  • Check logs: docker-compose logs -f api"
echo "  • Check health: curl http://localhost:3000/health"
echo "  • View tables: docker-compose exec api npm run db:log-tables"
echo ""
