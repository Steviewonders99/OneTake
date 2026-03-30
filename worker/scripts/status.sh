#!/bin/bash
# Quick status check: pending jobs, active workers, recent errors
cd "$(dirname "$0")/.."

echo "=== Pending Jobs ==="
/opt/homebrew/bin/python3.13 -c "
import asyncio, asyncpg, os
from dotenv import load_dotenv
load_dotenv()
DATABASE_URL = os.environ.get('DATABASE_URL', '')
async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    pending = await conn.fetchval(\"SELECT COUNT(*) FROM compute_jobs WHERE status = 'pending'\")
    processing = await conn.fetchval(\"SELECT COUNT(*) FROM compute_jobs WHERE status = 'processing'\")
    rows = await conn.fetch(\"SELECT worker_id, id::text, request_id::text FROM compute_jobs WHERE status = 'processing' ORDER BY started_at\")
    print(f'Pending: {pending}  Processing: {processing}')
    for r in rows:
        print(f'  {r[\"worker_id\"] or \"?\"}: job={r[\"id\"][:8]}... request={r[\"request_id\"][:8]}...')
    await conn.close()
asyncio.run(main())
"

echo ""
echo "=== Worker Processes ==="
ps aux | grep "main.py\|supervisor.py" | grep python | grep -v grep

echo ""
echo "=== Recent Errors (last 5) ==="
grep -h "ERROR\|FAILED\|crashed" logs/*.log 2>/dev/null | tail -5
