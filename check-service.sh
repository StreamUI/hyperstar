#!/bin/bash
set -e

SPRITE_NAME="${1:-simple-test}"

if [ -z "$SPRITE_TOKEN" ]; then
  echo "❌ SPRITE_TOKEN not set"
  exit 1
fi

echo "🔍 Checking service status for: $SPRITE_NAME"
echo ""

echo "1️⃣ List all services:"
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services" | jq .
echo ""

echo "2️⃣ Get hyperstar-app service details:"
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/hyperstar-app" | jq .
echo ""

echo "3️⃣ Try to get service logs:"
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/hyperstar-app/logs?lines=100"
echo ""

echo "4️⃣ List exec sessions (old method):"
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/exec" | jq .
echo ""

echo "✅ Done"
