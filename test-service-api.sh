#!/bin/bash
set -e

SPRITE_NAME="${1:-simple-test}"

if [ -z "$SPRITE_TOKEN" ]; then
  echo "❌ SPRITE_TOKEN not set"
  exit 1
fi

echo "Testing Services API directly"
echo "=============================="
echo ""

echo "1️⃣ Create service with minimal config:"
curl -X PUT \
  -H "Authorization: Bearer $SPRITE_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/test-http" \
  -d '{
    "cmd": "sh",
    "args": ["-c", "cd /app && PORT=8080 bun run app.ts"],
    "http_port": 8080,
    "needs": []
  }' | jq .

echo ""
echo "2️⃣ Start the service and watch logs:"
curl -X POST \
  -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/test-http/start?duration=10s" \
  -N

echo ""
echo "3️⃣ Check service status:"
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/test-http" | jq .

echo ""
echo "✅ Test complete"
