#!/bin/bash
set -e

SPRITE_NAME="${1:-my-app}"

echo "🔍 Debugging Sprite: $SPRITE_NAME"
echo ""

# Check if SPRITE_TOKEN is set
if [ -z "$SPRITE_TOKEN" ]; then
  echo "❌ SPRITE_TOKEN not set"
  exit 1
fi

echo "1️⃣ Checking sprite info..."
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME" | jq .
echo ""

echo "2️⃣ Checking service definition..."
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/hyperstar-app" | jq .
echo ""

echo "3️⃣ Checking service status..."
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/hyperstar-app/status" | jq .
echo ""

echo "4️⃣ Getting service logs (last 50 lines)..."
curl -s -H "Authorization: Bearer $SPRITE_TOKEN" \
  "https://api.sprites.dev/v1/sprites/$SPRITE_NAME/services/hyperstar-app/logs?lines=50"
echo ""

echo "5️⃣ Checking if files exist in /app..."
sprite api -s "$SPRITE_NAME" /exec -XPOST --data-urlencode "cmd=ls" --data-urlencode "cmd=-la" --data-urlencode "cmd=/app" --data-urlencode "stdin=false"
echo ""

echo "6️⃣ Checking if bun can find the app..."
sprite api -s "$SPRITE_NAME" /exec -XPOST --data-urlencode "cmd=bun" --data-urlencode "cmd=run" --data-urlencode "cmd=--version" --data-urlencode "dir=/app" --data-urlencode "stdin=false"
echo ""

echo "7️⃣ Testing direct bun run (should see error if any)..."
sprite api -s "$SPRITE_NAME" /exec -XPOST --data-urlencode "cmd=bun" --data-urlencode "cmd=run" --data-urlencode "cmd=app.ts" --data-urlencode "dir=/app" --data-urlencode "stdin=false" --data-urlencode "env=PORT=8080"
echo ""

echo "✅ Debug complete!"
