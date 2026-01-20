#!/bin/bash
set -e

if [ -z "$SPRITE_TOKEN" ]; then
  echo "❌ SPRITE_TOKEN not set"
  exit 1
fi

SPRITE_NAME="simple-test"

echo "Testing Services API directly with curl..."
echo ""

echo "1️⃣ Attempting to create service with exact format from docs:"
curl -v -X PUT \
  -H "Authorization: Bearer $SPRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cmd": "sh",
    "args": ["-c", "cd /app && PORT=8080 exec bun run app.ts"],
    "http_port": 8080,
    "needs": []
  }' \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/hyperstar-app"

echo ""
echo ""
echo "2️⃣ Trying with name in body (even though docs don't show it):"
curl -v -X PUT \
  -H "Authorization: Bearer $SPRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hyperstar-app",
    "cmd": "sh",
    "args": ["-c", "cd /app && PORT=8080 exec bun run app.ts"],
    "http_port": 8080,
    "needs": []
  }' \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/test-with-name"
