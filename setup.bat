@echo off
echo ===================================================
echo   LeadPilot Setup - Installing Prerequisites
echo ===================================================
echo.

echo [1/5] Installing root dependencies...
call npm ci
if errorlevel 1 goto :install_failed
echo.

echo [2/5] Installing backend dependencies...
cd backend
call npm ci
if errorlevel 1 goto :install_failed
cd ..
echo.

echo [3/5] Installing frontend dependencies (including Supabase and query cache packages)...
cd frontend
call npm ci
if errorlevel 1 goto :install_failed
cd ..
echo.

echo [4/5] Creating local frontend configuration if needed...
if not exist frontend\.env.local (
  copy frontend\.env.example frontend\.env.local >nul
  echo Created frontend\.env.local from the example file.
  echo Update VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before starting the app.
) else (
  echo frontend\.env.local already exists. Keeping your existing configuration.
)
echo.

echo [5/5] Installing Playwright browsers for the local scraper...
cd backend
call npx playwright install
if errorlevel 1 goto :install_failed
cd ..
echo.

echo ===================================================
echo   Setup Complete!
echo ===================================================
echo Commands:
echo   npm start       - Start the frontend at http://localhost:5173 and local scraper API at http://localhost:3001
echo   npm run build   - Create a production frontend build in frontend\dist
echo   npm run lint    - Check the frontend source
echo.
echo Supabase:
echo   - The frontend requires frontend\.env.local with your Supabase URL and publishable key.
echo   - Database migrations live in supabase\migrations and are already applied to the configured project.
echo   - Edge Function deployment is optional and requires the Supabase CLI plus webhook secrets.
echo.
pause
exit /b 0

:install_failed
echo.
echo Setup stopped because a dependency or browser installation failed.
echo Review the error above, then run setup.bat again.
pause
exit /b 1