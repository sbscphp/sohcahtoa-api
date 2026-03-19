#!/bin/bash

echo "🔄 Restarting Application with Updated Swagger Configuration"
echo "=============================================================="
echo ""

# Step 1: Build TypeScript
echo "📦 Step 1: Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful"
echo ""

# Step 2: Check if running in Docker or local
if docker ps | grep -q "sochatoa"; then
    echo "🐳 Detected Docker deployment"
    echo ""

    echo "📦 Step 2: Rebuilding Docker image..."
    docker-compose build
    if [ $? -ne 0 ]; then
        echo "❌ Docker build failed!"
        exit 1
    fi
    echo "✅ Docker build successful"
    echo ""

    echo "🔄 Step 3: Restarting Docker containers..."
    docker-compose down
    docker-compose up -d
    if [ $? -ne 0 ]; then
        echo "❌ Docker restart failed!"
        exit 1
    fi
    echo "✅ Docker containers restarted"
    echo ""

    echo "📋 Checking logs for Swagger initialization..."
    sleep 3
    docker-compose logs --tail=50 | grep -E "(Swagger|📚|🔍)"

else
    echo "💻 Detected local deployment"
    echo ""

    echo "🔄 Step 2: Starting development server..."
    echo "   (Run 'npm run dev' in a separate terminal)"
    echo ""
    echo "   Or run now:"
    read -p "   Start dev server now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run dev
    fi
fi

echo ""
echo "=============================================================="
echo "✅ Application restarted with updated Swagger configuration"
echo ""
echo "📚 Access Swagger UI at:"
echo "   - http://localhost:3000/api-docs/"
echo "   - http://localhost:3000/api-docs.json (JSON spec)"
echo ""
echo "🔍 Check server logs for:"
echo "   - 🔍 Swagger scanning paths: [...]"
echo "   - 📚 Swagger generated XXX API endpoints"
echo ""
echo "💡 If you don't see endpoints, check the console output above"
echo "   for the number of endpoints generated."
echo "=============================================================="
