@echo off
echo ========================================
echo WARNING: This will delete ALL database data!
echo ========================================
echo.
set /p confirm="Are you sure? Type 'yes' to continue: "

if not "%confirm%"=="yes" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Stopping containers and removing volumes...
docker-compose down -v

echo.
echo Starting fresh containers...
docker-compose up -d postgres-auth postgres-transaction postgres-payment postgres-document postgres-compliance postgres-admin postgres-audit redis kafka

echo.
echo Waiting for databases to be ready...
timeout /t 30 /nobreak >nul

echo.
echo Running migrations...

cd apps\auth-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

cd apps\transaction-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

cd apps\payment-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

cd apps\document-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

cd apps\compliance-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

cd apps\admin-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

cd apps\audit-service
echo init | call pnpm prisma migrate dev --name init
cd ..\..

echo.
echo Databases reset successfully!
echo.
pause
