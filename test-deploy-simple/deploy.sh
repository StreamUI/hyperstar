#!/bin/bash
set -e

DEPLOY_SERVER="${1:-http://localhost:3000}"

echo "📦 Creating bundle..."
tar -czf bundle.tar.gz app.ts hyperstar.json package.json

echo "🚀 Deploying to $DEPLOY_SERVER..."
RESPONSE=$(curl -s -X POST \
  -F "bundle=@bundle.tar.gz" \
  "$DEPLOY_SERVER/deploy")

echo ""
echo "✅ Response:"
echo "$RESPONSE" | jq .

URL=$(echo "$RESPONSE" | jq -r .url)

if [ "$URL" != "null" ]; then
  echo ""
  echo "🌟 App URL: $URL"
  echo ""
  echo "Open this URL to verify the service is running!"
fi

rm -f bundle.tar.gz
