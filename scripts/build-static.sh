#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/dist"

if [[ -z "${SPUNFLEX_BASIC_AUTH:-}" && "${ALLOW_UNPROTECTED_BUILD:-}" != "1" ]]; then
  echo "ERRO: defina SPUNFLEX_BASIC_AUTH no ambiente de deploy (ex.: usuario:senha-forte)." >&2
  echo "Use ALLOW_UNPROTECTED_BUILD=1 apenas para testes locais sem dados reais." >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cp "$ROOT_DIR/index.html" "$OUT_DIR/"
cp "$ROOT_DIR/styles.css" "$OUT_DIR/"
cp "$ROOT_DIR/app.js" "$OUT_DIR/"
cp "$ROOT_DIR/data.js" "$OUT_DIR/"
cp "$ROOT_DIR/stock-data.js" "$OUT_DIR/"
cp "$ROOT_DIR/_redirects" "$OUT_DIR/"
cp -R "$ROOT_DIR/assets" "$OUT_DIR/"

while IFS= read -r -d '' file; do
  cp "$file" "$OUT_DIR/"
done < <(find "$ROOT_DIR" -maxdepth 1 -type f \( -name "*.jpeg" -o -name "*.jpg" -o -name "*.xlsx" \) -print0)

{
  echo "/*"
  if [[ -n "${SPUNFLEX_BASIC_AUTH:-}" ]]; then
    echo "  Basic-Auth: ${SPUNFLEX_BASIC_AUTH}"
  fi
  echo "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
  echo "  X-Frame-Options: DENY"
  echo "  X-Content-Type-Options: nosniff"
  echo "  Referrer-Policy: no-referrer"
  echo "  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=(), browsing-topics=()"
  echo "  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
  echo "  Cross-Origin-Opener-Policy: same-origin"
  echo "  Cross-Origin-Resource-Policy: same-origin"
  echo "  X-Robots-Tag: noindex, nofollow, noarchive"
  echo ""
  echo "/assets/*"
  echo "  Cache-Control: public, max-age=31536000, immutable"
  echo ""
  echo "/*.css"
  echo "  Cache-Control: no-store"
  echo ""
  echo "/*.js"
  echo "  Cache-Control: no-store"
  echo ""
  echo "/*.xlsx"
  echo "  Cache-Control: no-store"
  echo ""
  echo "/*.jpeg"
  echo "  Cache-Control: no-store"
} > "$OUT_DIR/_headers"

if [[ -n "${SPUNFLEX_BASIC_AUTH:-}" ]]; then
  HOST_AUTH="true"
  CLIENT_AUTH="false"
else
  HOST_AUTH="false"
  CLIENT_AUTH="true"
fi

{
  echo "window.SpunflexSecurity = Object.freeze({"
  echo "  hostAuthRequired: ${HOST_AUTH},"
  echo "  allowClientAuth: ${CLIENT_AUTH},"
  echo "  activationCodesEnabled: false,"
  echo "  sessionMaxAgeMinutes: 480"
  echo "});"
} > "$OUT_DIR/security-runtime.js"

echo "Build gerado em $OUT_DIR"
