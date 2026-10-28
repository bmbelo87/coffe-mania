#!/bin/bash
set -e

mkdir -p /app/.runtime /app/pb_data
if [ ! -f /app/.runtime/game-secret ]; then
  head -c 32 /dev/urandom | base64 > /app/.runtime/game-secret
fi

export COFFE_GAME_SECRET_FILE=/app/.runtime/game-secret
export COFFE_BACKEND_URL=http://127.0.0.1:8090
export COFFE_GAME_URL=http://127.0.0.1:8091
export COFFE_GAME_ADDR=127.0.0.1:8091
export COFFE_PUBLIC_DIR=/app/game/dist
export COFFE_DEV_SEED=true
export COFFE_DEV_TOOLS=true
export COFFE_SECURE_COOKIES=false

echo "Iniciando PocketBase na porta 8090..."
/app/coffe-database serve --http=127.0.0.1:8090 --dir=/app/pb_data &
PB_PID=$!

echo "Iniciando WebSocket Game Server na porta 8091..."
/app/coffe-game &
GAME_PID=$!

echo "Iniciando Caddy Proxy na porta ${PORT:-10000}..."
caddy run --config /app/Caddyfile --adapter caddyfile &
CADDY_PID=$!

trap "kill $PB_PID $GAME_PID $CADDY_PID 2>/dev/null || true; exit 0" SIGTERM SIGINT

wait -n
