#!/bin/bash
# ══════════════════════════════════════════════════════════════
# OneTake Command Center — Thursday L1 Demo Launcher
# ══════════════════════════════════════════════════════════════
#
# Starts both the DB proxy (→ Azure PG) and the Next.js dev server
# with proxy wiring enabled. One command, full demo.
#
# Usage:
#   ./scripts/demo-thursday.sh
#   Then open: http://localhost:3000/insights/command-center
#
# To stop: Ctrl+C (kills both processes)
# ══════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")/.."

# Colors
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
PINK='\033[0;95m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

echo ""
echo -e "${PURPLE}${BOLD}  ╔══════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}${BOLD}  ║  OneTake — Project Command Center Demo          ║${NC}"
echo -e "${PURPLE}${BOLD}  ║  L1 Leadership Presentation · May 22, 2026      ║${NC}"
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

# ── Start Next.js ─────────────────────────────────────────────
echo ""
echo -e "${PINK}${BOLD}Starting Next.js dev server (port 3000)...${NC}"
echo -e "${DIM}  DB_PROXY_URL=http://localhost:$PROXY_PORT${NC}"
echo ""

echo -e "${PURPLE}${BOLD}  ┌──────────────────────────────────────────────────┐${NC}"
echo -e "${PURPLE}${BOLD}  │                                                  │${NC}"
echo -e "${PURPLE}${BOLD}  │  Open: http://localhost:3000/insights/command-center  │${NC}"
echo -e "${PURPLE}${BOLD}  │                                                  │${NC}"
echo -e "${PURPLE}${BOLD}  │  Login with Clerk → Dashboard loads real data    │${NC}"
echo -e "${PURPLE}${BOLD}  │  from Azure PG via proxy                         │${NC}"
echo -e "${PURPLE}${BOLD}  │                                                  │${NC}"
echo -e "${PURPLE}${BOLD}  │  Press Ctrl+C to stop everything                 │${NC}"
echo -e "${PURPLE}${BOLD}  │                                                  │${NC}"
echo -e "${PURPLE}${BOLD}  └──────────────────────────────────────────────────┘${NC}"
echo ""

# Trap Ctrl+C to kill both processes
cleanup() {
  echo ""
  echo -e "${DIM}Shutting down...${NC}"
  kill $PROXY_PID 2>/dev/null
  lsof -ti:3000 2>/dev/null | xargs kill 2>/dev/null || true
  echo -e "${DIM}Done.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start Next.js in foreground with proxy env vars
DB_PROXY_URL="http://localhost:$PROXY_PORT" \
DB_PROXY_SECRET="$PROXY_SECRET" \
npm run dev
