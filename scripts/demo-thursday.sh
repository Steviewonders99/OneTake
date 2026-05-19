#!/bin/bash
# ══════════════════════════════════════════════════════════════
# OneTake Command Center — Thursday L1 Demo Launcher
# ══════════════════════════════════════════════════════════════
#
# Starts the DB proxy, ngrok tunnel, and sets Vercel env var so
# leadership can access the live dashboard from any device.
#
# Usage:
#   ./scripts/demo-thursday.sh          # local only (localhost:3000)
#   ./scripts/demo-thursday.sh --live   # ngrok tunnel for leadership access
#
# To stop: Ctrl+C (kills all processes)
# ══════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")/.."

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
PURPLE='\033[0;35m'
PINK='\033[0;95m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

LIVE_MODE=false
if [[ "$1" == "--live" ]]; then
  LIVE_MODE=true
fi

echo ""
echo -e "${PURPLE}${BOLD}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}${BOLD}  ║  OneTake — Project Command Center Demo          ║${NC}"
echo -e "${PURPLE}${BOLD}  ║  L1 Leadership Presentation · May 22, 2026      ║${NC}"
if $LIVE_MODE; then
echo -e "${PURPLE}${BOLD}  ║  MODE: 🌐 LIVE (ngrok tunnel for leadership)    ║${NC}"
else
echo -e "${PURPLE}${BOLD}  ║  MODE: 💻 LOCAL (localhost only)                ║${NC}"
fi
echo -e "${PURPLE}${BOLD}  ╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Config ────────────────────────────────────────────────────
PROXY_PORT=8080
PROXY_SECRET="demo-thursday-2026"
AZURE_DB="postgresql://sqladm:fTpQ6iZAE7clL9pEU0gvFAnRtZow8bGn@onetake-pg-west01.postgres.database.azure.com:5432/onetake_db?sslmode=require"
PYTHON="/opt/homebrew/bin/python3.12"

# ── Preflight ─────────────────────────────────────────────────
echo -e "${DIM}Checking prerequisites...${NC}"

if ! command -v $PYTHON &> /dev/null; then
  echo "❌ Python 3.12 not found at $PYTHON"
  exit 1
fi

if ! $PYTHON -c "import aiohttp" 2>/dev/null; then
  echo "❌ aiohttp not installed. Run: $PYTHON -m pip install --break-system-packages aiohttp"
  exit 1
fi

if ! $PYTHON -c "import asyncpg" 2>/dev/null; then
  echo "❌ asyncpg not installed. Run: $PYTHON -m pip install --break-system-packages asyncpg"
  exit 1
fi

echo -e "  ✓ Python 3.12 + aiohttp + asyncpg"

if $LIVE_MODE; then
  if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found. Install: brew install ngrok"
    exit 1
  fi
  echo -e "  ✓ ngrok installed"
fi

# Kill any existing processes on our ports
lsof -ti:$PROXY_PORT 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# ── Start DB Proxy ────────────────────────────────────────────
echo ""
echo -e "${BLUE}${BOLD}Starting DB Proxy → Azure PG (port $PROXY_PORT)...${NC}"

DATABASE_URL="$AZURE_DB" \
PROXY_SECRET="$PROXY_SECRET" \
PROXY_PORT="$PROXY_PORT" \
$PYTHON worker/db_proxy.py &
PROXY_PID=$!

sleep 3

# Verify proxy is up
if curl -s http://localhost:$PROXY_PORT/health | grep -q '"ok": true'; then
  echo -e "  ${BLUE}✓ Proxy connected to Azure PG${NC}"
else
  echo "  ❌ Proxy failed to start"
  kill $PROXY_PID 2>/dev/null
  exit 1
fi

# Quick data check
PROJECT_COUNT=$(curl -s -H "Authorization: Bearer $PROXY_SECRET" \
  "http://localhost:$PROXY_PORT/projects" | $PYTHON -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
echo -e "  ${BLUE}✓ $PROJECT_COUNT projects loaded from Azure PG${NC}"

# ── Start ngrok tunnel (live mode) ───────────────────────────
NGROK_URL=""
if $LIVE_MODE; then
  echo ""
  echo -e "${GREEN}${BOLD}Starting ngrok tunnel → proxy:$PROXY_PORT...${NC}"

  ngrok http $PROXY_PORT --log=stdout > /tmp/ngrok.log 2>&1 &
  NGROK_PID=$!

  # Wait for tunnel to establish
  sleep 4

  # Extract the public URL
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | $PYTHON -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        url = t.get('public_url', '')
        if url.startswith('https://'):
            print(url)
            break
except: pass
" 2>/dev/null)

  if [ -n "$NGROK_URL" ]; then
    echo -e "  ${GREEN}✓ Tunnel active: ${BOLD}$NGROK_URL${NC}"
    echo ""
    echo -e "${GREEN}${BOLD}  ┌──────────────────────────────────────────────────────┐${NC}"
    echo -e "${GREEN}${BOLD}  │                                                      │${NC}"
    echo -e "${GREEN}${BOLD}  │  🌐 PROXY URL FOR VERCEL:                            │${NC}"
    echo -e "${GREEN}${BOLD}  │  $NGROK_URL${NC}"
    echo -e "${GREEN}${BOLD}  │                                                      │${NC}"
    echo -e "${GREEN}${BOLD}  │  Set in Vercel Dashboard → Environment Variables:    │${NC}"
    echo -e "${GREEN}${BOLD}  │    DB_PROXY_URL = $NGROK_URL${NC}"
    echo -e "${GREEN}${BOLD}  │    DB_PROXY_SECRET = $PROXY_SECRET                   │${NC}"
    echo -e "${GREEN}${BOLD}  │                                                      │${NC}"
    echo -e "${GREEN}${BOLD}  │  Then redeploy or trigger a new deployment.          │${NC}"
    echo -e "${GREEN}${BOLD}  │  Leadership can access the dashboard at:             │${NC}"
    echo -e "${GREEN}${BOLD}  │  https://onetake.oneforma.com/insights/command-center│${NC}"
    echo -e "${GREEN}${BOLD}  │                                                      │${NC}"
    echo -e "${GREEN}${BOLD}  └──────────────────────────────────────────────────────┘${NC}"
  else
    echo -e "  ⚠️  ngrok started but couldn't get URL. Check: http://localhost:4040"
    echo -e "  You may need to run: ngrok config add-authtoken YOUR_TOKEN"
  fi
fi

# ── Start Next.js ─────────────────────────────────────────────
echo ""
echo -e "${PINK}${BOLD}Starting Next.js dev server (port 3000)...${NC}"

PROXY_URL_FOR_NEXTJS="http://localhost:$PROXY_PORT"
if [ -n "$NGROK_URL" ]; then
  echo -e "${DIM}  DB_PROXY_URL=$NGROK_URL (via ngrok)${NC}"
  PROXY_URL_FOR_NEXTJS="$NGROK_URL"
else
  echo -e "${DIM}  DB_PROXY_URL=http://localhost:$PROXY_PORT (local)${NC}"
fi

echo ""
echo -e "${PURPLE}${BOLD}  ┌──────────────────────────────────────────────────┐${NC}"
echo -e "${PURPLE}${BOLD}  │                                                  │${NC}"
echo -e "${PURPLE}${BOLD}  │  Local:  http://localhost:3000/insights/command-center  │${NC}"
if [ -n "$NGROK_URL" ]; then
echo -e "${PURPLE}${BOLD}  │  Live:   Set DB_PROXY_URL in Vercel → redeploy  │${NC}"
fi
echo -e "${PURPLE}${BOLD}  │                                                  │${NC}"
echo -e "${PURPLE}${BOLD}  │  Press Ctrl+C to stop everything                 │${NC}"
echo -e "${PURPLE}${BOLD}  │                                                  │${NC}"
echo -e "${PURPLE}${BOLD}  └──────────────────────────────────────────────────┘${NC}"
echo ""

# Trap Ctrl+C to kill all processes
cleanup() {
  echo ""
  echo -e "${DIM}Shutting down...${NC}"
  kill $PROXY_PID 2>/dev/null
  [ -n "$NGROK_PID" ] && kill $NGROK_PID 2>/dev/null
  lsof -ti:3000 2>/dev/null | xargs kill 2>/dev/null || true
  echo -e "${DIM}Done.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start Next.js in foreground with proxy env vars
DB_PROXY_URL="$PROXY_URL_FOR_NEXTJS" \
DB_PROXY_SECRET="$PROXY_SECRET" \
npm run dev
