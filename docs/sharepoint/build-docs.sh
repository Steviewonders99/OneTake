#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPORT_DIR="$ROOT_DIR/docs/sharepoint/exports"

mkdir -p "$EXPORT_DIR"

pandoc "$ROOT_DIR/docs/sharepoint/Centric-Intake-Product-Overview.md" \
  --from markdown \
  --to docx \
  --toc \
  --toc-depth=2 \
  --output "$EXPORT_DIR/Centric-Intake-Product-Overview.docx"

pandoc "$ROOT_DIR/docs/technical-breakdown.md" \
  --from markdown \
  --to docx \
  --toc \
  --toc-depth=2 \
  --output "$EXPORT_DIR/Centric-Intake-Technical-Breakdown.docx"

pandoc "$ROOT_DIR/docs/sharepoint/Centric-Intake-Workflow-Diagrams.md" \
  --from markdown \
  --to docx \
  --toc \
  --toc-depth=2 \
  --output "$EXPORT_DIR/Centric-Intake-Workflow-Diagrams.docx"

pandoc "$ROOT_DIR/README.md" \
  --from markdown \
  --to docx \
  --toc \
  --toc-depth=2 \
  --output "$EXPORT_DIR/Centric-Intake-GitHub-README.docx"

echo "Generated SharePoint documents in $EXPORT_DIR"
