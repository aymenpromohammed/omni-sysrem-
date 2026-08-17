@echo off
chcp 65001 >nul 2>&1
title itqan soft - POS System

echo ================================================
echo   itqan soft - نظام نقطة المبيعات
echo   جاري التشغيل...
echo ================================================
echo.

REM التحقق من وجود المجلدات
if not exist "artifacts\api-server" (
    echo خطأ: مجلد api-server غير موجود
    pause
    exit /b 1
)

if not exist "artifacts\pos-system" (
    echo خطأ: مجلد pos-system غير موجود
    pause
    exit /b 1
)

echo [1/2] تشغيل API Server على port 8080...
cd /d "%~dp0artifacts\api-server"
if exist "dist\index.mjs" (
    start "API Server" cmd /c "set PORT=8080 && set NODE_ENV=production && node --enable-source-maps dist\index.mjs"
) else (
    echo خطأ: ملف dist\index.mjs غير موجود - قم بتشغيل setup.bat اولا
    pause
    exit /b 1
)

timeout /t 3 /nobreak >nul

echo [2/2] تشغيل Frontend على port 5000...
cd /d "%~dp0artifacts\pos-system"
if exist "node_modules\.bin\vite" (
    start "Frontend" cmd /c "set PORT=5000 && node_modules\.bin\vite --config vite.config.ts --host 0.0.0.0"
) else (
    echo خطأ: Vite غير مثبت - قم بتشغيل npm install اولا
    pause
    exit /b 1
)

timeout /t 5 /nobreak >nul

echo.
echo ================================================
echo   النظام يعمل الان!
echo   API Server: http://localhost:8080
echo   Frontend:   http://localhost:5000
echo.
echo   بيانات الدخول:
echo   المدير:   admin / admin123
echo   الكاشير:  cashier / cashier123
echo ================================================
start http://localhost:5000

pause