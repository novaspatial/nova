#!/usr/bin/env bash
# Verify that Supabase's auth URL configuration lets confirmation-email links
# land on /auth/callback (where the session gets minted) instead of being
# swallowed by the Site URL fallback.
#
# Mints a real signup confirmation link via the admin generate_link endpoint
# (no email is sent), follows it, and asserts the 303 lands on /auth/callback.
# The probe user is deleted afterwards. Needs SUPABASE_SERVICE_ROLE_KEY and
# NEXT_PUBLIC_SUPABASE_URL (sourced from .env.local when present).
#
#   GREEN — redirect allowlist honors the callback URL; signup flow works.
#   RED   — GoTrue swapped the callback for the Site URL; new clients will
#           land on the homepage unauthenticated. Fix in the dashboard:
#           Authentication → URL Configuration.
#
# Usage: scripts/verify-auth-redirects.sh [redirect_to]
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -f .env.local ]; then set -a; source .env.local; set +a; fi
BASE="$NEXT_PUBLIC_SUPABASE_URL"
KEY="$SUPABASE_SERVICE_ROLE_KEY"
REDIRECT_TO="${1:-https://nova-spatial.com/auth/callback?next=%2Fportal}"

EMAIL="signup-probe-$(date +%s)@nova-spatial.com"

# GoTrue reads redirect_to from the query string, not the JSON body — the
# official supabase-js admin.generateLink() sends it exactly this way
# (auth-js lib/fetch.js appends `?redirect_to=...` to the request URL).
# Nesting it in the body (e.g. under "options") is silently ignored and
# always falls back to the Site URL, producing a false RED regardless of
# the actual redirect allowlist.
ENCODED_REDIRECT_TO=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$REDIRECT_TO")

RESP=$(curl -s -X POST "$BASE/auth/v1/admin/generate_link?redirect_to=$ENCODED_REDIRECT_TO" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"signup\",\"email\":\"$EMAIL\",\"password\":\"Probe-$(date +%s)-pw\"}")

ACTION_LINK=$(printf '%s' "$RESP" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("action_link",""))')
USER_ID=$(printf '%s' "$RESP" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("user",d).get("id",""))')

cleanup() {
  if [ -n "$USER_ID" ]; then
    curl -s -o /dev/null -X DELETE "$BASE/auth/v1/admin/users/$USER_ID" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
    echo "probe user deleted    : $USER_ID"
  fi
}
trap cleanup EXIT

if [ -z "$ACTION_LINK" ]; then
  echo "generate_link failed:"
  printf '%s\n' "$RESP" | python3 -m json.tool | grep -viE 'token|link' || true
  exit 2
fi

echo "requested redirect_to : $REDIRECT_TO"
echo "action_link (redacted): $(printf '%s' "$ACTION_LINK" | sed -E 's/token=[^&]+/token=REDACTED/')"

# HEAD is rejected by /verify, so issue a GET and read the redirect target.
LOCATION=$(curl -s -o /dev/null -w '%{redirect_url}' "$ACTION_LINK")
echo "verify 303 Location   : $(printf '%s' "$LOCATION" | sed -E 's/(code|access_token|refresh_token)=[^&#]+/\1=REDACTED/g')"

case "$LOCATION" in
  *"/auth/callback"*) echo "VERDICT: GREEN — confirmation link lands on /auth/callback" ;;
  *) echo "VERDICT: RED — confirmation link does NOT land on /auth/callback"; exit 1 ;;
esac
