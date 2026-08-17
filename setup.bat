@echo off
chcp 65001 >nul
echo ================================================
echo   itqan soft - نظام نقطة المبيعات
echo   اعداد Windows
echo ================================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [خطا] Node.js غير مثبت!
    echo حمّل من: https://nodejs.org
    pause & exit /b 1
)
echo [OK] Node.js موجود

pnpm --version >nul 2>&1
if errorlevel 1 (
    echo [تثبيت] pnpm...
    npm install -g pnpm
)
echo [OK] pnpm موجود

echo.
echo [1/2] اعادة بناء better-sqlite3 لـ Windows...
call pnpm rebuild better-sqlite3
if errorlevel 1 (
    echo [خطا] فشل بناء better-sqlite3
    echo ثبّت Visual Studio Build Tools من:
    echo https://aka.ms/vs/17/release/vs_BuildTools.exe
    echo اختر: Desktop development with C++
    pause & exit /b 1
)

echo.
echo [2/2] بناء API Server...
cd artifacts\api-server
call node build.mjs
cd ..\..

echo.
echo ================================================
echo   الاعداد اكتمل بنجاح! شغّل: start.bat
echo ================================================
pause
