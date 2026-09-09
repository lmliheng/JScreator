#!/usr/bin/env bash
# -------------------------------------------------------------------
# JScreator quick smoke test - check 8 core GET endpoints
# Usage: same as test_api.sh, just checks if core services are alive
# -------------------------------------------------------------------
BASE_URL="${1:-${BASE_URL:-http://localhost:7000}}"
PASS=0 FAIL=0

check() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}$1" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^2[0-9][0-9]$ ]] || [[ "$code" == "302" ]]; then
    printf "  \033[32m[OK] %s\033[0m  %s\n" "$code" "$2"
    ((PASS++))
  else
    printf "  \033[31m[FAIL] %s\033[0m  %s\n" "$code" "$2"
    ((FAIL++))
  fi
}

echo ""
echo "+----------------------------------------------+"
echo "|   JScreator quick smoke test                  |"
echo "|   ${BASE_URL}"
echo "+----------------------------------------------+"
echo ""

check "/"                    "1/8  health check"
check "/article/list"        "2/8  article list"
check "/article/category/list" "3/8  category list"
check "/blog/users"          "4/8  blog users"
check "/blog/feed"           "5/8  feed"
check "/role/list"           "6/8  role list"
check "/ad/slots"            "7/8  ad slots"
check "/announcement/latest" "8/8  latest announcement"

echo ""
echo "-- result: ${PASS} passed, ${FAIL} failed --"
[ "$FAIL" -eq 0 ] && echo "[OK] core services are healthy" || echo "[FAIL] service abnormal, check logs"
echo ""
[ "$FAIL" -eq 0 ]