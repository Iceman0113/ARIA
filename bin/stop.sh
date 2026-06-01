#!/usr/bin/env bash
# Stop ARIA. Reads PIDs from logs/, terminates the process groups,
# then sweeps the ports as a backstop.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"

kill_service() {
  local service=$1
  local pid_file="$LOG_DIR/$service.pid"
  [ -f "$pid_file" ] || return 0
  local pid
  pid=$(cat "$pid_file" 2>/dev/null || true)
  rm -f "$pid_file"
  [ -n "$pid" ] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  # npm spawns node which spawns child workers — kill the whole group
  local pgid
  pgid=$(ps -o pgid= "$pid" 2>/dev/null | tr -d ' ')
  if [ -n "$pgid" ]; then
    echo "  Stopping $service (PID $pid, group $pgid)..."
    kill -TERM -"$pgid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  else
    echo "  Stopping $service (PID $pid)..."
    kill -TERM "$pid" 2>/dev/null || true
  fi
}

kill_service server
kill_service client

# Backstop — anything still on the ports
for port in 3001 5174 5175; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  Sweeping port $port (PIDs: $pids)..."
    kill -TERM $pids 2>/dev/null || true
    sleep 0.5
    # Force if still alive
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  fi
done

echo "✓ ARIA stopped"
