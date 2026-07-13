@echo off
REM Levanta el server de desarrollo con el Node 24.18 (el global tuyo es viejo para Angular).
set "PATH=D:\Programs\node24\node-v24.18.0-win-x64;%PATH%"
cd /d "%~dp0"
call npx ng serve --port 4200 %*
