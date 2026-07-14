@echo off
echo ===================================================
echo   LeadPilot Setup - Installing Prerequisites
echo ===================================================
echo.

echo [1/4] Installing root dependencies...
call npm install
echo.

echo [2/4] Installing backend dependencies...
cd backend
call npm install
cd ..
echo.

echo [3/4] Installing frontend dependencies...
cd frontend
call npm install
cd ..
echo.

echo [4/4] Installing Playwright browsers for the scraper...
cd backend
call npx playwright install
cd ..
echo.

echo ===================================================
echo   Setup Complete!
echo ===================================================
echo You can now start the application by running:
echo npm start
echo.
pause
