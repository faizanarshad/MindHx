#!/usr/bin/env bash
# Runs the FastAPI backend (localhost-only) and the Next.js standalone
# server (public, on Railway's $PORT) as sibling processes in one
# container. If either dies, the container exits so Railway restarts it.
set -euo pipefail

export PORT="${PORT:-3000}"

uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 &
API_PID=$!

node server.js &
WEB_PID=$!

trap 'kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true' TERM INT

wait -n "$API_PID" "$WEB_PID"
EXIT_CODE=$?
kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true
exit "$EXIT_CODE"
