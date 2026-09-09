@echo off
setlocal enabledelayedexpansion

REM ===========================================================================
REM JScreator API health check script (Windows CMD)
REM Usage:
REM   scripts\test_api.cmd                  [default http://localhost:7000]
REM   scripts\test_api.cmd http://example.com
REM   set BASE_URL=http://example.com && scripts\test_api.cmd
REM
REM Set TOKEN env to test authenticated endpoints:
REM   set TOKEN=your_jwt_token_here && scripts\test_api.cmd
REM   set ADMIN_TOKEN=your_admin_jwt_here && scripts\test_api.cmd
REM ===========================================================================

set "BASE_URL=%~1"
if "%BASE_URL%"=="" set "BASE_URL=%BASE_URL_env%"
if "%BASE_URL%"=="" set "BASE_URL=http://localhost:7000"

set "PASS=0"
set "FAIL=0"

echo.
echo ====== JScreator API health check ======
echo   BASE_URL = %BASE_URL%
if not "%TOKEN%"=="" (echo   TOKEN    = set) else (echo   TOKEN    = not set ^(skip auth^))
if not "%ADMIN_TOKEN%"=="" (echo   ADMIN_TOKEN = set) else (echo   ADMIN_TOKEN = not set ^(skip admin^))
echo.
echo   %DATE% %TIME%
echo.

REM --------------------------- 1. Core infrastructure ------------------------
echo ------- [1] Core infrastructure -------
call :do_get "health check" "/"

REM --------------------------- 2. Article module -----------------------------
echo.
echo ------- [2] Article module -------
call :do_get "article list"           "/article/list"
call :do_get "article archive"        "/article/archive"
call :do_get "category list"          "/article/category/list"
call :do_get "article detail"         "/article/detail/1"

REM --------------------------- 3. Blog module --------------------------------
echo.
echo ------- [3] Blog module -------
call :do_get "blog users"             "/blog/users"
call :do_get "feed"                   "/blog/feed"
call :do_get "hot content"            "/blog/hot"
call :do_get "blog profile"           "/blog/profile/admin"
call :do_get "user articles"          "/blog/articles/admin"

REM --------------------------- 4. Social module (public) ---------------------
echo.
echo ------- [4] Social module (public) -------
call :do_get "following"              "/social/following/admin"
call :do_get "followers"              "/social/followers/admin"
call :do_get "social stats"           "/social/stats/admin"

REM --------------------------- 5. Comment / RBAC / Content -------------------
echo.
echo ------- [5] Comment -------
call :do_get "article comments"       "/comment/list/1"

echo.
echo ------- [6] RBAC -------
call :do_get "role list"              "/role/list"
call :do_get "permission list"        "/permission/list"

echo.
echo ------- [7] Ads / Announcements -------
call :do_get "ad slots"               "/ad/slots"
call :do_get "latest announcement"    "/announcement/latest"

REM --------------------------- Authenticated (TOKEN) -------------------------
if not "%TOKEN%"=="" (
  echo.
  echo ------- [8] Authenticated endpoints -------
  call :do_get_auth "my articles"          "/article/mine"
  call :do_get_auth "TOTP status"          "/totp/status"
  call :do_get_auth "current user profile" "/sys/profile"
  call :do_get_auth "user detail"          "/user-manage/detail/1"
  call :do_get_auth "DM conversations"     "/dm/conversations"
  call :do_get_auth "DM unread count"      "/dm/unread-count"
  call :do_get_auth "social status"        "/social/status"
  call :do_get_auth "my favorites"         "/social/my-favorites"
  call :do_get_auth "social notifications" "/social/notifications"
  call :do_get_auth "social notif unread"  "/social/notifications/unread-count"
  call :do_get_auth "notification list"    "/notification/list"
  call :do_get_auth "unread notif count"   "/notification/unread-count"
  call :do_get_auth "API keys"             "/api-keys"
)

if not "%ADMIN_TOKEN%"=="" (
  echo.
  echo ------- [9] Admin endpoints -------
  call :do_get_admin "user manage list"        "/user-manage/list"
  call :do_get_admin "OAuth clients"           "/oauth/admin/clients"
  call :do_get_admin "comment manage list"     "/comment/manage/list"
  call :do_get_admin "likes manage list"        "/social/admin/likes"
  call :do_get_admin "favorites manage list"    "/social/admin/favorites"
  call :do_get_admin "ad manage list"           "/ad/admin/list"
  call :do_get_admin "announcement manage list"  "/announcement/admin/list"
  call :do_get_admin "role permissions"         "/role/permission/1"
  call :do_get_admin "system monitor"           "/system-monitor"
  call :do_get_admin "API stats"                "/system-monitor/api-stats"
  call :do_get_admin "backup download"          "/backup/download"
)

REM --------------------------- Summary ---------------------------------------
echo.
echo ====== Test summary ======
echo   passed: %PASS%
echo   failed: %FAIL%
set /a TOTAL = PASS + FAIL
echo   total : %TOTAL%
echo.

if %FAIL% gtr 0 (
  echo Some endpoints returned errors, check service status.
  exit /b 1
)
exit /b 0

REM ===========================================================================
REM Subroutines
REM ===========================================================================

:do_get
set "NAME=%~1"
set "URL=%~2"
for /f %%C in ('curl -s -o NUL -w "%%{http_code}" "%BASE_URL%%URL%" 2^>NUL') do set "CODE=%%C"
if "%CODE%"=="" set "CODE=000"

if "%CODE%" geq "200" if "%CODE%" lss "400" (
  echo   [PASS] %NAME% ^(%CODE%^)
  set /a PASS+=1
) else if "%CODE%"=="302" (
  echo   [PASS] %NAME% ^(%CODE%^)
  set /a PASS+=1
) else (
  echo   [FAIL] %NAME% ^(%CODE%^)
  set /a FAIL+=1
)
exit /b

:do_get_auth
set "NAME=%~1"
set "URL=%~2"
for /f %%C in ('curl -s -o NUL -w "%%{http_code}" -H "Authorization: Bearer %TOKEN%" "%BASE_URL%%URL%" 2^>NUL') do set "CODE=%%C"
if "%CODE%"=="" set "CODE=000"

if "%CODE%" geq "200" if "%CODE%" lss "400" (
  echo   [PASS] %NAME% ^(%CODE%^)
  set /a PASS+=1
) else (
  echo   [FAIL] %NAME% ^(%CODE%^)
  set /a FAIL+=1
)
exit /b

:do_get_admin
set "NAME=%~1"
set "URL=%~2"
for /f %%C in ('curl -s -o NUL -w "%%{http_code}" -H "Authorization: Bearer %ADMIN_TOKEN%" "%BASE_URL%%URL%" 2^>NUL') do set "CODE=%%C"
if "%CODE%"=="" set "CODE=000"

if "%CODE%" geq "200" if "%CODE%" lss "400" (
  echo   [PASS] %NAME% ^(%CODE%^)
  set /a PASS+=1
) else (
  echo   [FAIL] %NAME% ^(%CODE%^)
  set /a FAIL+=1
)
exit /b