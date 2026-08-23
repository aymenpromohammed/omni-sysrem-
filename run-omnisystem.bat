@echo off
title تشغيل نظام الكاشير
cd /d "%~dp0"

:: تشغيل السيرفر
start cmd /k "npm run dev"

:: انتظار 5 ثواني
timeout /t 5 /nobreak >nul

:: فتح المتصفح
start "" "http://localhost:3000/pos"

echo =======================================================================
echo         النظام يعمل الان
echo         http://localhost:3000/pos
echo =======================================================================

exit