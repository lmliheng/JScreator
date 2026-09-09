@echo off
setlocal enabledelayedexpansion
set "BASE_URL=%~1"
if "%BASE_URL%"=="" set "BASE_URL=%BASE_URL_env%"
if "%BASE_URL%"=="" set "BASE_URL=http://localhost:7000"

set PASS=0
set FAIL=0

echo.
echo ====== JScreator quick smoke test ======
echo   BASE_URL = %BASE_URL%
echo.

call :check "/"                   "1/8 health check"
call :check "/article/list"       "2/8 article list"
call :check "/article/category/list" "3/8 category list"
call :check "/blog/users"         "4/8 blog users"
call :check "/blog/feed"          "5/8 feed"
call :check "/role/list"          "6/8 role list"
call :check "/ad/slots"           "7/8 ad slots"
call :check "/announcement/latest" "8/8 latest announcement"

echo.
echo  result: %PASS% passed, %FAIL% failed
if %FAIL% equ 0 (echo  [OK] core services healthy) else (echo  [FAIL] service abnormal)
echo.
exit /b %FAIL%

:check
for /f %%C in ('curl -s -o NUL -w "%%{http_code}" "%BASE_URL%%~1" 2^>NUL') do set "CODE=%%C"
if "%CODE%"=="" set "CODE=000"
if "%CODE%" geq "200" if "%CODE%" lss "400" (
  echo   [PASS] %~2 ^(%CODE%^)
  set /a PASS+=1
) else (
  echo   [FAIL] %~2 ^(%CODE%^)
  set /a FAIL+=1
)
exit /b