#!/usr/bin/env bash
# ============================================================================
# JScreator API health check script
# Usage:
#   ./scripts/test_api.sh                  # default http://localhost:7000
#   BASE_URL=http://example.com ./scripts/test_api.sh
#   ./scripts/test_api.sh http://example.com
#
# Return code: 0=all passed, 1=some failed
# ============================================================================
set -euo pipefail

# -- config -----------------------------------------------------------------
BASE_URL="${1:-${BASE_URL:-http://localhost:7000}}"
TOKEN="${TOKEN:-}"           # set TOKEN to test authenticated endpoints
ADMIN_TOKEN="${ADMIN_TOKEN:-}"  # admin token for admin endpoints

PASS=0
FAIL=0
FAILED_NAMES=""

color() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
green()  { color '0;32' "$1"; }
red()    { color '0;31' "$1"; }
yellow() { color '0;33' "$1"; }
bold()   { color '1' "$1"; }

do_get() {
  local name="$1" url="$2" extra_args="${3:-}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" ${extra_args} "${BASE_URL}${url}" 2>/dev/null || echo "000")

  if [[ "$code" =~ ^2[0-9][0-9]$ ]] || [[ "$code" == "302" ]]; then
    printf "  %-50s %s\n" "$name" "$(green "[OK] ${code}")"
    ((PASS++))
  else
    printf "  %-50s %s\n" "$name" "$(red "[FAIL] ${code}")"
    ((FAIL++))
    FAILED_NAMES+="$name "
  fi
}

section() {
  echo ""
  echo "===================================================="
  echo "  $(bold "$1")"
  echo "===================================================="
}

# -- start -----------------------------------------------------------------
echo ""
echo "$(bold 'JScreator API health check')"
echo "  $(yellow 'BASE_URL')  = ${BASE_URL}"
echo "  $(yellow 'TOKEN')     = $([ -n "$TOKEN" ] && echo 'set' || echo 'not set (skip auth endpoints')"
echo "  $(yellow 'ADMIN_TOKEN') = $([ -n "$ADMIN_TOKEN" ] && echo 'set' || echo 'not set (skip admin endpoints')"
echo "  $(yellow 'time')       = $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ==========================================================================
# Part 1: Core infrastructure
# ==========================================================================
section "[1] Core infrastructure"

do_get "health check (GET /)" "/"

# ==========================================================================
# Part 2: Article module
# ==========================================================================
section "[2] Article module"

do_get "article list"           "/article/list"
do_get "article archive"        "/article/archive"
do_get "category list"          "/article/category/list"
do_get "article detail (id=1)"  "/article/detail/1"

# ==========================================================================
# Part 3: Blog module
# ==========================================================================
section "[3] Blog module"

do_get "blog users"             "/blog/users"
do_get "feed"                   "/blog/feed"
do_get "hot content"            "/blog/hot"
do_get "blog profile (admin)"   "/blog/profile/admin"
do_get "user articles (admin)"  "/blog/articles/admin"

# ==========================================================================
# Part 4: Social module (public)
# ==========================================================================
section "[4] Social module (public)"

do_get "following (admin)"      "/social/following/admin"
do_get "followers (admin)"      "/social/followers/admin"
do_get "social stats (admin)"   "/social/stats/admin"

# ==========================================================================
# Part 5: Comment module
# ==========================================================================
section "[5] Comment module"

do_get "article comments (article=1)" "/comment/list/1"

# ==========================================================================
# Part 6: RBAC (roles / permissions)
# ==========================================================================
section "[6] RBAC roles / permissions"

do_get "role list"              "/role/list"
do_get "permission list"        "/permission/list"

# ==========================================================================
# Part 7: Content module (ads / announcements)
# ==========================================================================
section "[7] Content module (ads / announcements)"

do_get "ad slots"               "/ad/slots"
do_get "latest announcement"    "/announcement/latest"

# ==========================================================================
# Authenticated endpoints (require TOKEN)
# ==========================================================================
if [ -n "$TOKEN" ]; then
  AUTH="--header Authorization: Bearer ${TOKEN}"

  section "[A] Authenticated endpoints (TOKEN)"

  do_get "my articles"             "/article/mine"            "$AUTH"
  do_get "TOTP status"             "/totp/status"            "$AUTH"
  do_get "current user profile"    "/sys/profile"            "$AUTH"
  do_get "user detail (id=1)"      "/user-manage/detail/1"   "$AUTH"
  do_get "DM conversations"        "/dm/conversations"       "$AUTH"
  do_get "DM unread count"         "/dm/unread-count"        "$AUTH"
  do_get "social status"           "/social/status"          "$AUTH"
  do_get "my favorites"            "/social/my-favorites"    "$AUTH"
  do_get "social notifications"    "/social/notifications"   "$AUTH"
  do_get "social notif. unread"    "/social/notifications/unread-count" "$AUTH"
  do_get "notification list"       "/notification/list"      "$AUTH"
  do_get "unread notification cnt" "/notification/unread-count" "$AUTH"
  do_get "API keys"                "/api-keys"               "$AUTH"

  if [ -n "$ADMIN_TOKEN" ]; then
    AUTH_ADMIN="--header Authorization: Bearer ${ADMIN_TOKEN}"

    section "[B] Admin endpoints"

    do_get "user manage list"         "/user-manage/list"         "$AUTH_ADMIN"
    do_get "OAuth clients"            "/oauth/admin/clients"     "$AUTH_ADMIN"
    do_get "comment manage list"      "/comment/manage/list"     "$AUTH_ADMIN"
    do_get "likes manage list"        "/social/admin/likes"      "$AUTH_ADMIN"
    do_get "favorites manage list"    "/social/admin/favorites"  "$AUTH_ADMIN"
    do_get "ad manage list"           "/ad/admin/list"           "$AUTH_ADMIN"
    do_get "announcement manage list" "/announcement/admin/list" "$AUTH_ADMIN"
    do_get "role permissions (id=1)" "/role/permission/1"       "$AUTH_ADMIN"
    do_get "system monitor"           "/system-monitor"          "$AUTH_ADMIN"
    do_get "API stats"                "/system-monitor/api-stats" "$AUTH_ADMIN"
    do_get "backup download"          "/backup/download"         "$AUTH_ADMIN"
  fi
fi

# ==========================================================================
# Summary
# ==========================================================================
echo ""
echo "===================================================="
echo "  $(bold 'Test summary')"
echo "===================================================="
printf "  %-20s %s\n" "passed" "$(green "${PASS}")"
printf "  %-20s %s\n" "failed" "$(red "${FAIL}")"
printf "  %-20s %s\n" "total" "$((PASS + FAIL))"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  printf "  $(red 'failed endpoints:') %s\n" "$FAILED_NAMES"
fi
echo ""

# exit code
[ "$FAIL" -eq 0 ]