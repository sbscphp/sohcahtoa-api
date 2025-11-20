@echo off
echo ========================================
echo Fixing bcrypt Installation Issue
echo ========================================
echo.

echo This will replace bcrypt with bcryptjs (pure JavaScript, no compilation needed)
echo.

echo [1/2] Cleaning old installations...
rmdir /s /q node_modules 2>nul
rmdir /s /q apps\auth-service\node_modules 2>nul
rmdir /s /q packages\shared-utils\node_modules 2>nul

echo [2/2] Installing dependencies with bcryptjs...
call pnpm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Installation failed!
    echo.
    echo Try installing Windows Build Tools manually:
    echo   Open PowerShell as Administrator and run:
    echo   npm install -g windows-build-tools
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Fix Complete!
echo ========================================
echo.
echo bcryptjs has been installed successfully.
echo You can now continue with the setup.
echo.
pause
