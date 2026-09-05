@echo off
REM Lanceur local — le PATH Windows de Cursor n'inclut pas toujours WinGet.
setlocal
set "NGROK_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Links\ngrok.exe"
if not exist "%NGROK_EXE%" (
  for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.*") do (
    if exist "%%D\ngrok.exe" set "NGROK_EXE=%%D\ngrok.exe"
  )
)
if not exist "%NGROK_EXE%" (
  echo ngrok.exe introuvable. lancez: winget install Ngrok.Ngrok
  exit /b 1
)
"%NGROK_EXE%" %*
