#!/usr/bin/env bash
# Show current state of ARIA.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"

probe() {
  curl -sf --max-time 2 "$1" >/dev/null 2>&1 && echo "✓ healthy" || echo "✗ down"
}

pid_state() {
  local pid_file="$LOG_DIR/$1.pid"
  if [ ! -f "$pid_file" ]; then
    echo "(no pid file)"
    return
  fi
  local pid
  pid=$(cat "$pid_file" 2>/dev/null || true)
  if [ -z "$pid" ]; then
    echo "(empty pid file)"
    return
  fi
  if kill -0 "$pid" 2>/dev/null; then
    echo "PID $pid (alive)"
  else
    echo "PID $pid (DEAD — stale pid file)"
  fi
}

echo "═══ ARIA Status ═══"
echo "  Server (:3001)  →  $(probe http://localhost:3001/health)   $(pid_state server)"
echo "  Client (:5174)  →  $(probe http://localhost:5174/)   $(pid_state client)"
echo
if [ -f "$LOG_DIR/server.log" ]; then
  echo "  --- last 5 server log lines ---"
  tail -5 "$LOG_DIR/server.log" 2>/dev/null | sed 's/^/  /'
fi
echo
echo "  HUD:   http://localhost:5174"
echo "  Tail:  tail -f $LOG_DIR/server.log"
