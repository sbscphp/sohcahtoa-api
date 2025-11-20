@echo off
echo ========================================
echo FX Transaction Platform - Setup Script
echo ========================================
echo.

echo [1/5] Installing dependencies...
call pnpm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

echo [2/5] Copying environment files...
copy apps\auth-service\.env.example apps\auth-service\.env >nul 2>&1
copy apps\transaction-service\.env.example apps\transaction-service\.env >nul 2>&1
copy apps\payment-service\.env.example apps\payment-service\.env >nul 2>&1
copy apps\document-service\.env.example apps\document-service\.env >nul 2>&1
copy apps\compliance-service\.env.example apps\compliance-service\.env >nul 2>&1
copy apps\admin-service\.env.example apps\admin-service\.env >nul 2>&1
copy apps\audit-service\.env.example apps\audit-service\.env >nul 2>&1
copy apps\notification-service\.env.example apps\notification-service\.env >nul 2>&1
copy apps\api-gateway\.env.example apps\api-gateway\.env >nul 2>&1
echo Environment files created!
echo.

echo [3/5] Generating Prisma clients...
cd apps\auth-service
call pnpm prisma:generate
cd ..\..

cd apps\transaction-service
call pnpm prisma:generate
cd ..\..

cd apps\payment-service
call pnpm prisma:generate
cd ..\..

cd apps\document-service
call pnpm prisma:generate
cd ..\..

cd apps\compliance-service
call pnpm prisma:generate
cd ..\..

cd apps\admin-service
call pnpm prisma:generate
cd ..\..

cd apps\audit-service
call pnpm prisma:generate
cd ..\..

echo Prisma clients generated!
echo.

echo [4/5] Starting Docker containers...
docker-compose up -d postgres-auth postgres-transaction postgres-payment postgres-document postgres-compliance postgres-admin postgres-audit redis kafka
if %errorlevel% neq 0 (
    echo ERROR: Failed to start Docker containers
    echo Make sure Docker Desktop is running!
    pause
    exit /b 1
)
echo Docker containers started!
echo.

echo Waiting 30 seconds for databases to be ready...
timeout /t 30 /nobreak >nul
echo.

echo [5/5] Running database migrations...
echo Creating auth database schema...
cd apps\auth-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo Creating transaction database schema...
cd apps\transaction-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo Creating payment database schema...
cd apps\payment-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo Creating document database schema...
cd apps\document-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo Creating compliance database schema...
cd apps\compliance-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo Creating admin database schema...
cd apps\admin-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo Creating audit database schema...
cd apps\audit-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run "npm run start:all" to start all services
echo 2. Or run "pnpm dev" for development mode
echo.
echo Services will be available at:
echo - API Gateway: http://localhost:3000
echo - Auth Service: http://localhost:3001
echo - Document Service: http://localhost:3002
echo - Transaction Service: http://localhost:3003
echo - Payment Service: http://localhost:3004
echo - Compliance Service: http://localhost:3005
echo - Notification Service: http://localhost:3006
echo - Admin Service: http://localhost:3007
echo - Audit Service: http://localhost:3008
echo.
pause
