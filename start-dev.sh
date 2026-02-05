#!/bin/bash
set -e

echo "🔄 Stopping existing servers..."
pkill -f "pnpm dev" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

echo "🚀 Starting API server on port 3001..."
cd /workspaces/Unifocus-Simple/services/api
export $(grep -v '^#' .env | xargs)
pnpm dev > /tmp/api.log 2>&1 &
API_PID=$!
echo "   API PID: $API_PID"

sleep 5

echo "🚀 Starting Web server on port 3000..."
cd /workspaces/Unifocus-Simple/apps/web
export $(grep -v '^#' .env | xargs)
pnpm dev > /tmp/web.log 2>&1 &
WEB_PID=$!
echo "   Web PID: $WEB_PID"

sleep 5

echo ""
echo "✅ Servers started!"
echo "   API: https://scaling-parakeet-ww5qr4gqgwvc95j4-3001.app.github.dev"
echo "   Web: https://scaling-parakeet-ww5qr4gqgwvc95j4-3000.app.github.dev"
echo ""
echo "📋 To view logs:"
echo "   API: tail -f /tmp/api.log"
echo "   Web: tail -f /tmp/web.log"
echo ""
echo "🛑 To stop servers:"
echo "   pkill -f 'pnpm dev'"
