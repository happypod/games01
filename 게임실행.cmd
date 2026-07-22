@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Emberwatch Launcher

set "CHECK_ONLY=0"
set "ROOT_READY=0"
if /I "%~1"=="--check" set "CHECK_ONLY=1"

pushd "%~dp0" 2>nul
if errorlevel 1 goto :project_missing
set "ROOT_READY=1"

if not exist "package.json" goto :project_missing
if not exist "package-lock.json" goto :lock_missing

where.exe node >nul 2>nul
if errorlevel 1 goto :node_missing

where.exe npm.cmd >nul 2>nul
if errorlevel 1 goto :npm_missing

node -e "const [M,m]=process.versions.node.split('.').map(Number);process.exit(M>22||(M===22&&m>=12)?0:1)" >nul 2>&1
if errorlevel 1 goto :node_old

for /f "delims=" %%V in ('node --version') do set "NODE_VERSION=%%V"
echo [OK] Node.js %NODE_VERSION%

set "NEEDS_INSTALL=0"
if not exist "node_modules\.package-lock.json" set "NEEDS_INSTALL=1"
if not exist "node_modules\.bin\vite.cmd" set "NEEDS_INSTALL=1"
if "%NEEDS_INSTALL%"=="0" (
  call npm.cmd ls --depth=0 >nul 2>nul
  if errorlevel 1 set "NEEDS_INSTALL=1"
)

if "%NEEDS_INSTALL%"=="1" (
  echo [SETUP] Installing game packages for the first launch...
  call npm.cmd ci
  if errorlevel 1 goto :install_failed
)

if not exist "node_modules\.bin\vite.cmd" goto :vite_missing

if "%CHECK_ONLY%"=="1" (
  echo [OK] Game packages are ready.
  echo [DONE] Launcher check passed. No server or browser was started.
  popd
  exit /b 0
)

echo.
echo [START] Emberwatch is starting. Your browser will open automatically.
echo [STOP] Press Ctrl+C in this window to stop the game server.
echo.
call npm.cmd run dev -- --open
if errorlevel 1 goto :server_failed

popd
exit /b 0

:node_missing
echo [ERROR] Node.js is not installed.
echo Install Node.js 22.12 or newer, then run this file again: https://nodejs.org/
goto :failed

:npm_missing
echo [ERROR] npm.cmd was not found. Reinstall Node.js and try again.
goto :failed

:node_old
for /f "delims=" %%V in ('node --version') do set "NODE_VERSION=%%V"
echo [ERROR] The current Node.js version is %NODE_VERSION%.
echo Update to Node.js 22.12 or newer, then try again: https://nodejs.org/
goto :failed

:project_missing
echo [ERROR] The Emberwatch project files were not found.
echo Keep this launcher in the root folder of the game repository.
goto :failed

:lock_missing
echo [ERROR] package-lock.json was not found.
echo Download the complete repository again, then try again.
goto :failed

:install_failed
echo.
echo [ERROR] Package installation failed. Check the network and folder permissions.
goto :failed

:vite_missing
echo [ERROR] Vite was not installed correctly. Delete node_modules and try again.
goto :failed

:server_failed
echo.
echo [ERROR] The game server did not start correctly.
goto :failed

:failed
if "%CHECK_ONLY%"=="0" (
  echo.
  pause
)
if "%ROOT_READY%"=="1" popd
exit /b 1
