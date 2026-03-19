#!/bin/bash

echo "🔍 Swagger Configuration Diagnostics"
echo "====================================="
echo ""

# Check 1: TypeScript source files exist
echo "✓ Check 1: TypeScript route files"
ROUTE_COUNT=$(find src/modules -name "*routes*.ts" 2>/dev/null | wc -l)
echo "  Found $ROUTE_COUNT route files in src/modules"
echo ""

# Check 2: Compiled files exist
echo "✓ Check 2: Compiled JavaScript files"
COMPILED_COUNT=$(find dist/modules -name "*routes*.js" 2>/dev/null | wc -l)
echo "  Found $COMPILED_COUNT compiled route files in dist/modules"
echo ""

# Check 3: Swagger config file
echo "✓ Check 3: Swagger configuration"
if [ -f "src/shared/utils/swagger.ts" ]; then
    echo "  ✅ swagger.ts exists"
    echo "  Scanning for apiPaths configuration..."
    grep -A 10 "const apiPaths" src/shared/utils/swagger.ts | head -15
else
    echo "  ❌ swagger.ts NOT FOUND"
fi
echo ""

# Check 4: Server status
echo "✓ Check 4: Server status"
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "  ✅ Server is running on port 3000"
else
    echo "  ❌ Server is NOT running on port 3000"
    echo "     Start the server with: npm run dev"
fi
echo ""

# Check 5: Swagger endpoint accessible
echo "✓ Check 5: Swagger endpoints"
if curl -s http://localhost:3000/api-docs.json >/dev/null 2>&1; then
    echo "  ✅ Swagger JSON endpoint accessible"

    # Count paths in the spec
    PATH_COUNT=$(curl -s http://localhost:3000/api-docs.json 2>/dev/null | grep -o '"paths":\s*{' | wc -l)
    if [ "$PATH_COUNT" -gt 0 ]; then
        echo "  ✅ Swagger spec contains paths"
        # Try to count actual endpoints
        ENDPOINT_COUNT=$(curl -s http://localhost:3000/api-docs.json 2>/dev/null | grep -o '"/api/[^"]*":' | wc -l)
        echo "  📊 Estimated endpoints: ~$ENDPOINT_COUNT"
    else
        echo "  ⚠️  Swagger spec has NO paths"
        echo "     This means JSDoc comments aren't being picked up"
    fi
else
    echo "  ❌ Swagger JSON endpoint NOT accessible"
    echo "     Check if server is running and swagger is configured"
fi
echo ""

# Check 6: Sample JSDoc in route file
echo "✓ Check 6: Sample JSDoc comment format"
SAMPLE_FILE=$(find src/modules -name "*routes*.ts" 2>/dev/null | head -1)
if [ -n "$SAMPLE_FILE" ]; then
    echo "  Checking: $SAMPLE_FILE"
    if grep -q "@swagger" "$SAMPLE_FILE"; then
        echo "  ✅ Contains @swagger JSDoc comments"
        echo "  Sample:"
        grep -A 3 "@swagger" "$SAMPLE_FILE" | head -8
    else
        echo "  ⚠️  No @swagger comments found in this file"
    fi
else
    echo "  ❌ No route files found"
fi
echo ""

# Summary
echo "====================================="
echo "📋 Summary & Next Steps:"
echo ""

if [ "$ROUTE_COUNT" -eq 0 ]; then
    echo "❌ CRITICAL: No TypeScript route files found!"
    echo "   Check your project structure"
elif curl -s http://localhost:3000/health >/dev/null 2>&1; then
    if curl -s http://localhost:3000/api-docs.json 2>/dev/null | grep -q '"paths":\s*{'; then
        echo "✅ Everything looks good!"
        echo "   If Swagger UI shows 'No operations', try:"
        echo "   1. Hard refresh browser (Ctrl+Shift+R)"
        echo "   2. Clear browser cache"
        echo "   3. Open in incognito/private window"
    else
        echo "⚠️  Swagger spec has no paths"
        echo "   → Rebuild and restart the server:"
        echo "     npm run build && npm run dev"
    fi
else
    echo "⚠️  Server is not running"
    echo "   → Start the server:"
    echo "     npm run dev"
    echo "     OR"
    echo "     docker-compose up -d"
fi
echo ""
echo "📚 After fixing, access Swagger at:"
echo "   http://localhost:3000/api-docs/"
echo "====================================="
