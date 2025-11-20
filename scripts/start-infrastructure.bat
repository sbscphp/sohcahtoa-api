@echo off
echo Starting infrastructure services (PostgreSQL, Redis, Kafka)...
echo.

docker-compose up -d postgres-auth postgres-transaction postgres-payment postgres-document postgres-compliance postgres-admin postgres-audit redis kafka

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start Docker containers
    echo Make sure Docker Desktop is running!
    pause
    exit /b 1
)

echo.
echo Infrastructure services started successfully!
echo.
echo Running containers:
docker ps
echo.
echo Waiting 30 seconds for services to be ready...
timeout /t 30 /nobreak >nul

echo.
echo Ready! You can now start the application services.
echo Run: pnpm dev
echo.
pause
