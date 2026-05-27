#!/bin/bash
set -e
trap 'echo ""; echo "Shutting down..."; kill 0' EXIT INT TERM

echo "▶  Starting Mapro backend  → http://localhost:3000"
(cd server && npm run dev) &

echo "▶  Starting Mapro frontend → http://localhost:5173"
(cd client && npm run dev) &

echo ""
echo "✓  Mapro is running. Open http://localhost:5173"
echo "   Ctrl+C to stop both."
echo ""

wait
