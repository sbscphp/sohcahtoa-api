@echo off
echo ========================================
echo Checking Health of All Services
echo ========================================
echo.

echo Checking API Gateway (Port 3000)...
curl -s http://localhost:3000/health
echo.
echo.

echo Checking Auth Service (Port 3001)...
curl -s http://localhost:3001/api/auth/health
echo.
echo.

echo Checking Document Service (Port 3002)...
curl -s http://localhost:3002/api/documents/health
echo.
echo.

echo Checking Transaction Service (Port 3003)...
curl -s http://localhost:3003/api/transactions/health
echo.
echo.

echo Checking Payment Service (Port 3004)...
curl -s http://localhost:3004/api/payments/health
echo.
echo.

echo Checking Compliance Service (Port 3005)...
curl -s http://localhost:3005/api/compliance/health
echo.
echo.

echo Checking Notification Service (Port 3006)...
curl -s http://localhost:3006/api/notifications/health
echo.
echo.

echo Checking Admin Service (Port 3007)...
curl -s http://localhost:3007/api/admin/health
echo.
echo.

echo Checking Audit Service (Port 3008)...
curl -s http://localhost:3008/api/audit/health
echo.
echo.

echo ========================================
echo Health Check Complete
echo ========================================
echo.
pause
