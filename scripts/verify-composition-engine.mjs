#!/usr/bin/env node
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { neon } from "@neondatabase/serverless";

const ROOT = join(import.meta.dirname, "..");
const WORKER_ROOT = join(ROOT, "worker");

let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

function warn(name, message) {
  console.log(`  ⚠ ${name}`);
  if (message) console.log(`     → ${message}`);
  warnings++;
}

function checkFile(name, filePath) {
  const exists = existsSync(filePath);
  check(name, exists);
  if (!exists) console.log(`     → ${filePath}`);
}

function checkPythonImport(name, importStatement) {
  try {
    execSync(`cd ${WORKER_ROOT} && python3 -c "${importStatement}; print('OK')"`, {
      stdio: "pipe",
      encoding: "utf8",
    });
    check(name, true);
  } catch (error) {
    check(name, false);
    console.log(`     → ${error.message.split("\n")[0]}`);
  }
}

async function main() {
  console.log("Stage 4 Composition Engine — Verification\n");

  // Database connection
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  // Database checks
  console.log("Database Checks:");
  try {
    // Check if table exists
    const tableCheckResult = await sql`
      SELECT EXISTS(
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'design_artifacts'
      ) as table_exists
    `;
    check(
      "design_artifacts table exists",
      tableCheckResult[0].table_exists === true
    );

    const countResult = await sql`SELECT count(*) as cnt FROM design_artifacts WHERE is_active = true`;
    const artifactCount = countResult[0].cnt;

    if (artifactCount > 0) {
      check(`Active artifacts present (${artifactCount})`, true);
      const categoryResult = await sql`SELECT count(DISTINCT category) as cnt FROM design_artifacts WHERE is_active = true`;
      const categoryCount = categoryResult[0].cnt;
      check(`At least 3 distinct categories exist (${categoryCount})`, categoryCount >= 3);
    } else {
      warn(`Design artifacts not seeded yet (${artifactCount} records)`, "Run 'node scripts/seed-design-artifacts.mjs' with BLOB_READ_WRITE_TOKEN set");
    }
  } catch (error) {
    check("design_artifacts table exists", false);
    console.log(`     → DB connection error: ${error.message}`);
  }

  // Python imports
  console.log("\nPython Imports:");
  checkPythonImport(
    "from neon_client import get_active_artifacts",
    "from neon_client import get_active_artifacts"
  );
  checkPythonImport(
    "from pipeline.archetype_selector import select_archetype",
    "from pipeline.archetype_selector import select_archetype"
  );
  checkPythonImport(
    "from prompts.compositor_prompt import build_compositor_prompt",
    "from prompts.compositor_prompt import build_compositor_prompt"
  );
  checkPythonImport("from pipeline.stage4_compose_v3 import run_stage4", "from pipeline.stage4_compose_v3 import run_stage4");
  checkPythonImport(
    "from pipeline.orchestrator import run_pipeline",
    "from pipeline.orchestrator import run_pipeline"
  );

  // File structure
  console.log("\nFile Structure:");
  checkFile("worker/pipeline/stage4_compose_v3.py", join(WORKER_ROOT, "pipeline/stage4_compose_v3.py"));
  checkFile("worker/pipeline/archetype_selector.py", join(WORKER_ROOT, "pipeline/archetype_selector.py"));
  checkFile("worker/prompts/compositor_prompt.py", join(WORKER_ROOT, "prompts/compositor_prompt.py"));
  checkFile("scripts/seed-design-artifacts.mjs", join(ROOT, "scripts/seed-design-artifacts.mjs"));
  checkFile(
    "src/app/api/export/figma/[assetId]/route.ts",
    join(ROOT, "src/app/api/export/figma/[assetId]/route.ts")
  );
  checkFile("src/app/admin/artifacts/page.tsx", join(ROOT, "src/app/admin/artifacts/page.tsx"));
  checkFile("src/app/api/admin/artifacts/route.ts", join(ROOT, "src/app/api/admin/artifacts/route.ts"));
  checkFile("scripts/artifacts/blobs/blob_organic_1.svg", join(ROOT, "scripts/artifacts/blobs/blob_organic_1.svg"));

  // Rollback check
  console.log("\nRollback Support:");
  checkFile("worker/pipeline/stage4_compose_v2.py (rollback)", join(WORKER_ROOT, "pipeline/stage4_compose_v2.py"));

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
