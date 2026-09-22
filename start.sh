#!/usr/bin/env bash
# Runs the FastAPI backend (localhost-only) and the Next.js standalone
# server (public, on Railway's $PORT) in one container.
#
# The backend runs under a respawn loop: if it crashes or gets OOM-killed
# (observed in production when loading the Whisper model under a tight
# memory limit), it restarts on its own instead of taking the whole
# container down. Next.js runs in the foreground as the container's main
# process - if it dies, the container exits so Railway restarts it, same
# as before.
set -uo pipefail

export PORT="${PORT:-3000}"

run_backend() {
  while true; do
    uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
    code=$?
    echo "start.sh: backend exited (code $code) - restarting in 2s" >&2
    sleep 2
  done
}

run_backend &
BACKEND_SUPERVISOR_PID=$!
trap 'kill -TERM "$BACKEND_SUPERVISOR_PID" 2>/dev/null || true' TERM INT

node server.js
WEB_EXIT_CODE=$?

kill -TERM "$BACKEND_SUPERVISOR_PID" 2>/dev/null || true
exit "$WEB_EXIT_CODE"
