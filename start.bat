@echo off
chcp 65001 >nul 2>&1
title OmniSystem Pro - POS System
cd /d "%~dp0"

echo ================================================
echo   OmniSystem Pro - نظام إدارة المبيعات والمحاسبة
echo   جاري فحص وتجهيز تشغيل النظام...
echo ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [خطأ] Node.js غير مثبت على الجهاز!
    echo يرجى تحميل وتثبيت Node.js من الموقع الرسمي: https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [تنبيه] التبعيات غير مثبتة، جاري تثبيت حزم النظام تلقائياً...
    call npm install
    if errorlevel 1 (
        echo [خطأ] فشل تثبيت الحزم عبر npm.
        pause
        exit /b 1
    )
)

echo [1/2] تشغيل سيرفر OmniSystem Pro الموحد...
start "OmniSystem POS Server" cmd /k "npm run dev"

timeout /t 4 /nobreak >nul

echo [2/2] فتح الواجهة الرئيسية في المتصفح...
start "" "http://localhost:3000/pos"

echo.
echo ================================================
echo   النظام يعمل الآن بنجاح!
echo   الرابط: http://localhost:3000/pos
echo.
echo   بيانات الدخول الافتراضية:
echo   المدير:   admin / admin123
echo   الكاشير:  cashier / cashier123
echo ================================================
exit