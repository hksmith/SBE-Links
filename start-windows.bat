@echo off
title SBPO Link Tree
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org , install it, then double-click this file again.
  pause
  exit /b
)

REM ---- change these if you want ----
set "ADMIN_USER=admin"
set "ADMIN_PASSWORD=admin123"
REM Local MongoDB (install "MongoDB Community Server" from https://www.mongodb.com/try/download/community)
REM or paste a MongoDB Atlas connection string here (keep the quotes).
set "MONGODB_URI=mongodb://127.0.0.1:27017/sbpo-link-tree"
REM ----------------------------------
set "PORT=3000"

if not exist "server\node_modules\mongodb" (
  echo Installing server packages, this only happens once...
  call npm install --prefix server --omit=dev
  if errorlevel 1 (
    echo Could not install packages. Check your internet connection and try again.
    pause
    exit /b
  )
)

if not exist "client\dist\index.html" (
  echo Building the admin app, this only happens once...
  call npm install --prefix client
  if errorlevel 1 (
    echo Could not install the admin app packages. Check your internet connection and try again.
    pause
    exit /b
  )
  call npm run build --prefix client
  if errorlevel 1 (
    echo Building the admin app failed. See the messages above.
    pause
    exit /b
  )
)

echo.
echo  SBPO Link Tree is starting...
echo  Admin login:  http://localhost:%PORT%/admin   (user: %ADMIN_USER%  password: %ADMIN_PASSWORD%)
echo  Keep this window open. Press Ctrl+C to stop.
echo.
start "" http://localhost:%PORT%/admin
node server\src\index.js
pause
