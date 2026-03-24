@echo off
chcp 65001 >nul 2>&1
title JMLP Casomira Simulator

echo =======================================
echo   JMLP Casomira Simulator - Setup
echo =======================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo CHYBA: Python neni nainstalovan!
    echo Stahnete ho z: https://www.python.org/downloads/
    echo Pri instalaci zaškrtnete "Add Python to PATH"
    pause
    exit /b 1
)

:: Install pyserial
echo Kontroluji pyserial...
pip show pyserial >nul 2>&1
if errorlevel 1 (
    echo Instaluji pyserial...
    pip install pyserial
    echo.
)

echo.
echo Vyber rezim:
echo   1 = Interaktivni (rucne zadavas casy)
echo   2 = Automaticky (nahodne casy kazdych par sekund) 
echo   3 = Automaticky - rychly (kazdou sekundu)
echo.
set /p choice="Vyber (1/2/3): "

if "%choice%"=="1" (
    python "%~dp0simulator.py" --port NULL_COM7
) else if "%choice%"=="2" (
    python "%~dp0simulator.py" --port NULL_COM7 --auto --interval 2
) else if "%choice%"=="3" (
    python "%~dp0simulator.py" --port NULL_COM7 --auto --interval 1
) else (
    echo Neplatna volba.
)

pause
