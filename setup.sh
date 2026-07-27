#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_root"

echo "==================================================="
echo "LeadPilot Setup - Installing Prerequisites"
echo "==================================================="
echo

echo "[1/6] Installing root dependencies..."
npm ci
echo

echo "[2/6] Installing backend dependencies..."
npm --prefix backend ci
echo

echo "[3/6] Installing frontend dependencies..."
npm --prefix frontend ci
echo

echo "[4/6] Creating local frontend configuration if needed..."
if [[ -f frontend/.env.local ]]; then
  echo "frontend/.env.local already exists. Keeping your existing configuration."
elif [[ -f frontend/.env.example ]]; then
  cp frontend/.env.example frontend/.env.local
  echo "Created frontend/.env.local from the example file."
  echo "Update VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before starting the app."
else
  echo "frontend/.env.example was not found; skipping local configuration creation."
fi
echo

echo "[5/6] Installing Playwright browsers for the local scraper..."
npm --prefix backend exec playwright install
echo

echo "[6/6] Applying database migrations and seed data..."
if [[ -f .env.supabase.local ]]; then
  npm run db:setup
else
  echo ".env.supabase.local not found. Skipping automatic migration run."
  echo "To run migrations automatically, create .env.supabase.local with SUPABASE_DB_URL."
fi
echo

echo "==================================================="
echo "Setup complete!"
echo "==================================================="
echo "Run: npm start"
