#!/usr/bin/env bash
# Start ARIA (server :3001 + Vite client :5174). Idempotent — refuses if
# ports are already in use. Logs and PIDs live under <ARIA>/logs/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

require_port_free() {
  local port=$1 name=$2
  if lsof -ti ":$port" >/dev/null 2>&1; then
    echo "✗ Port $port (${name}) is already in use." >&2
    echo "  Run: $ROOT/bin/stop.sh   (or:  $ROOT/bin/status.sh)" >&2
    exit 1
  fi
}

require_port_free 3001 "server"
require_port_free 5174 "client"

echo "→ Starting ARIA server (:3001)..."
( cd "$ROOT/server" && nohup npm run dev > "$LOG_DIR/server.log" 2>&1 & echo $! > "$LOG_DIR/server.pid" )

echo "→ Starting ARIA client (:5174)..."
( cd "$ROOT/client" && nohup npm run dev > "$LOG_DIR/client.log" 2>&1 & echo $! > "$LOG_DIR/client.pid" )

# Wait for server health
echo -n "→ Waiting for server"
for i in {1..30}; do
  if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo " ✗ (timed out after 30s — see $LOG_DIR/server.log)"
    exit 1
  fi
done

# Wait for TTS pre-warm (the boot is healthy without it, but TTS first-call
# is slow until this finishes)
echo -n "→ Waiting for Edge TTS pre-warm"
for i in {1..30}; do
  if grep -q "TTS: ✓ Edge pre-warmed" "$LOG_DIR/server.log" 2>/dev/null; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo " ⚠ (no pre-warm log — first TTS call will be ~2s)"
    break
  fi
done

# Wait for Vite
echo -n "→ Waiting for client"
for i in {1..30}; do
  if curl -sf http://localhost:5174/ >/dev/null 2>&1; then
    echo " ✓"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo " ✗ (timed out — see $LOG_DIR/client.log)"
    exit 1
  fi
done

cat <<EOF

═══ ARIA is up ═══
  HUD:    http://localhost:5174
  Health: http://localhost:3001/health
  Logs:   tail -f $LOG_DIR/server.log
          tail -f $LOG_DIR/client.log
  Stop:   $ROOT/bin/stop.sh
  Status: $ROOT/bin/status.sh

EOF
