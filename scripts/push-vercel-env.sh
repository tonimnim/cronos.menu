#!/usr/bin/env bash
# One-shot uploader: reads .env.local, pushes each var to Vercel
# Production + Preview. Overrides SITE_URL/APP_URL to the prod URL.
# Idempotent via --force.
set -euo pipefail

PROD_URL="https://cronosmenu-tonimnims-projects.vercel.app"

push_var() {
  local name="$1"
  local value="$2"
  for env in production preview; do
    # </dev/null prevents vercel from inheriting (and consuming) the
    # while-loop's stdin redirection from .env.local
    if vercel env add "$name" "$env" --value "$value" --force --yes \
         </dev/null >/dev/null 2>&1; then
      echo "  ✓ $name → $env"
    else
      echo "  ✗ $name → $env (FAILED)"
    fi
  done
}

while IFS='=' read -r key rest; do
  # skip blank lines and comments
  [[ -z "${key// }" || "$key" =~ ^# ]] && continue

  # Override site/app URL to prod
  case "$key" in
    NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_APP_URL) value="$PROD_URL" ;;
    *) value="$rest" ;;
  esac

  echo "→ $key"
  push_var "$key" "$value"
done < .env.local

echo
echo "Done. Verify with: vercel env ls"
