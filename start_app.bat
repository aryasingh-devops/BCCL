@echo off
cd /d "%~dp0"
rem Start the backend server and open the admin dashboard automatically.
call "%~dp0run_backend.bat" --open
