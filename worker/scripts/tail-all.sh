#!/bin/bash
# Tail all worker logs + supervisor log simultaneously
# Each line prefixed with the source file for easy filtering
cd "$(dirname "$0")/.."
tail -f logs/supervisor.log logs/worker-*.log 2>/dev/null | \
  sed -u 's|==> logs/\(.*\)\.log <==|\n--- \1 ---|'
