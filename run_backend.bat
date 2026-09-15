@echo off
cd /d "%~dp0"

set "OPEN_URL=http://localhost:8000/admin.html"
set "USE_START=0"
if /I "%1"=="--open" set "USE_START=1"
if /I "%1"=="--launch" set "USE_START=1"

goto :Start

:RunPython
set "PY_EXE=%~1"
if "%USE_START%"=="1" (
    start "BCCL Backend" "%PY_EXE%" server.py
    echo Waiting for backend to start...
    timeout /t 3 /nobreak >nul
    start "" "%OPEN_URL%"
    exit /b
)
"%PY_EXE%" server.py
exit /b

:Start
set "EMBED_PY=%~dp0python-embed\python.exe"
if exist "%EMBED_PY%" (
    call :RunPython "%EMBED_PY%"
    goto :EOF
)

where py >nul 2>nul
if %errorlevel%==0 (
    py --version >nul 2>nul
    if %errorlevel%==0 (
        call :RunPython py
        goto :EOF
    )
)

where python >nul 2>nul
if %errorlevel%==0 (
    python --version >nul 2>nul
    if %errorlevel%==0 (
        call :RunPython python
        goto :EOF
    )
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    python3 --version >nul 2>nul
    if %errorlevel%==0 (
        call :RunPython python3
        goto :EOF
    )
)

set "BUNDLED_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%BUNDLED_PY%" (
    call :RunPython "%BUNDLED_PY%"
    goto :EOF
)

echo Python was not found. Install Python or run server.py with an available Python interpreter.
pause
