#!/bin/bash
set -euo pipefail

# Load .env.local
ENV_FILE="$(dirname "$0")/../.env.local"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

if [ -z "${FASTPIX_TOKEN_ID:-}" ] || [ -z "${FASTPIX_SECRET_KEY:-}" ]; then
  echo "Error: FASTPIX_TOKEN_ID and FASTPIX_SECRET_KEY must be set in .env.local"
  exit 1
fi

echo "Creating new FastPix live stream..."

RESPONSE=$(curl -s -X POST https://api.fastpix.io/v1/live/streams \
  --user "${FASTPIX_TOKEN_ID}:${FASTPIX_SECRET_KEY}" \
  -H 'content-type: application/json' \
  -d '{
    "playbackSettings": { "accessPolicy": "public" },
    "inputMediaSettings": {
      "maxResolution": "1080p",
      "reconnectWindow": 60,
      "mediaPolicy": "public",
      "enableDvrMode": true,
      "lowLatency": true,
      "metadata": { "livestream_name": "fix_my_brain" }
    }
  }')

SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))")

if [ "$SUCCESS" != "True" ]; then
  echo "Failed to create stream:"
  echo "$RESPONSE" | python3 -m json.tool
  exit 1
fi

STREAM_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['streamId'])")
STREAM_KEY=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['streamKey'])")
PLAYBACK_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['playbackIds'][0]['id'])")

# Update .env.local
sed -i '' "s/^NEXT_PUBLIC_FASTPIX_PLAYBACK_ID=.*/NEXT_PUBLIC_FASTPIX_PLAYBACK_ID=${PLAYBACK_ID}/" "$ENV_FILE"

echo ""
echo "=== Stream Created ==="
echo "Stream ID:   $STREAM_ID"
echo "Playback ID: $PLAYBACK_ID"
echo ""
echo "=== OBS Settings ==="
echo "Server:      rtmps://live.fastpix.io:443/live"
echo "Stream Key:  $STREAM_KEY"
echo ""
echo ".env.local updated with new playback ID."
echo "Restart your dev server to pick up the change."
