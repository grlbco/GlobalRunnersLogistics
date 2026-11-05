@echo off
title Global Runners - local server
cd /d "%~dp0"
echo Starting the local site + CRM...
echo When it says Ready, open http://localhost:3000/crm
start "" http://localhost:3000/crm
npm run dev
pause
