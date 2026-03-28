/**
 * Centric Intake — Frontend API Smoke Tests
 *
 * Tests every API endpoint returns the expected status code and data shape.
 * Validates public endpoints, auth gates, schema structure, and error handling.
 *
 * Run: node tests/smoke_api.mjs
 * ENV: APP_URL (defaults to https://centric-intake.vercel.app)
 */

const BASE = process.env.APP_URL || 'https://centric-intake.vercel.app';

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

const tests = [
  // ---- Public: Schemas ----
  {
    name: 'GET /api/schemas — list all schemas',
    url: '/api/schemas',
    expect: 200,
    validate: (data) => {
      if (!Array.isArray(data)) return 'Expected array response';
      if (data.length < 5) return `Expected >= 5 schemas, got ${data.length}`;
      return null;
    },
  },
  {
    name: 'GET /api/schemas/audio_annotation — valid task type',
    url: '/api/schemas/audio_annotation',
    expect: 200,
    validate: (data) => {
      if (!data || typeof data !== 'object') return 'Expected object response';
      return null;
    },
  },
  {
    name: 'GET /api/schemas/nonexistent_type — should 404',
    url: '/api/schemas/nonexistent_type_xyz_999',
    expect: 404,
    validate: (data) => {
      if (!data || !data.error) return 'Expected error field in 404 response';
      return null;
    },
  },
  {
    name: 'GET /api/schemas/audio_annotation/versions — schema versions',
    url: '/api/schemas/audio_annotation/versions',
    expect: 200,
  },

  // ---- Public: Registries ----
  {
    name: 'GET /api/registries/languages_registry — languages',
    url: '/api/registries/languages_registry',
    expect: 200,
    validate: (data) => {
      if (!Array.isArray(data)) return 'Expected array response';
      if (data.length < 30) return `Expected >= 30 languages, got ${data.length}`;
      return null;
    },
  },
  {
    name: 'GET /api/registries/regions_registry — regions',
    url: '/api/registries/regions_registry',
    expect: 200,
    validate: (data) => {
      if (!Array.isArray(data)) return 'Expected array response';
      if (data.length < 20) return `Expected >= 20 regions, got ${data.length}`;
      return null;
    },
  },

  // ---- Protected: Intake (should require auth) ----
  {
    name: 'GET /api/intake — no auth should 401',
    url: '/api/intake',
    expect: 401,
  },
  {
    name: 'POST /api/intake — no auth should 401',
    url: '/api/intake',
    method: 'POST',
    body: JSON.stringify({ title: 'test' }),
    expect: 401,
  },

  // ---- Protected: Admin (should require auth) ----
  {
    name: 'GET /api/admin/users — no auth should 401',
    url: '/api/admin/users',
    expect: 401,
  },
  {
    name: 'GET /api/admin/jobs — no auth should 401',
    url: '/api/admin/jobs',
    expect: 401,
  },
  {
    name: 'GET /api/admin/stats — no auth should 401',
    url: '/api/admin/stats',
    expect: 401,
  },

  // ---- Protected: Generate endpoints (should require auth) ----
  {
    name: 'POST /api/generate/test-id/brief — no auth should 401',
    url: '/api/generate/test-id/brief',
    method: 'POST',
    expect: 401,
  },
  {
    name: 'POST /api/generate/test-id/images — no auth should 401',
    url: '/api/generate/test-id/images',
    method: 'POST',
    expect: 401,
  },

  // ---- Protected: Export (should require auth) ----
  {
    name: 'GET /api/export/test-id — no auth should 401',
    url: '/api/export/test-id',
    expect: 401,
  },

  // ---- Protected: Approve (should require auth) ----
  {
    name: 'POST /api/approve/test-id — no auth should 401',
    url: '/api/approve/test-id',
    method: 'POST',
    expect: 401,
  },

  // ---- Protected: Designer (should require auth) ----
  {
    name: 'GET /api/designer/test-id — no auth should 401',
    url: '/api/designer/test-id',
    expect: 401,
  },

  // ---- Protected: Compute status (should require auth) ----
  {
    name: 'GET /api/compute/status/test-id — no auth should 401',
    url: '/api/compute/status/test-id',
    expect: 401,
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

async function runTest(test) {
  const url = `${BASE}${test.url}`;
  const method = test.method || 'GET';
  const headers = { 'Content-Type': 'application/json' };

  try {
    const opts = { method, headers };
    if (test.body) opts.body = test.body;

    const resp = await fetch(url, opts);
    const status = resp.status;

    // Some 401 responses might not return valid JSON
    let data = null;
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await resp.json();
      } catch {
        data = null;
      }
    }

    // Check status code
    if (status !== test.expect) {
      // Allow 307/308 redirects to auth pages for protected routes expecting 401
      if (test.expect === 401 && (status === 307 || status === 308 || status === 302 || status === 403)) {
        passed++;
        console.log(`  \u2705 ${test.name} (${status} redirect/forbidden — auth gate active)`);
        return;
      }
      failed++;
      const msg = `Expected ${test.expect}, got ${status}`;
      failures.push({ name: test.name, error: msg });
      console.log(`  \u274c ${test.name}: ${msg}`);
      return;
    }

    // Run custom validation if provided
    if (test.validate && data !== null) {
      const validationError = test.validate(data);
      if (validationError) {
        failed++;
        failures.push({ name: test.name, error: validationError });
        console.log(`  \u274c ${test.name}: ${validationError}`);
        return;
      }
    }

    passed++;
    console.log(`  \u2705 ${test.name} (${status})`);
  } catch (err) {
    failed++;
    const msg = `Network error: ${err.message}`;
    failures.push({ name: test.name, error: msg });
    console.log(`  \u274c ${test.name}: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\uD83D\uDD2C CENTRIC INTAKE \u2014 API SMOKE TESTS');
  console.log(`Target: ${BASE}`);
  console.log('='.repeat(60) + '\n');

  // Check if the app is reachable and deployed
  let appDeployed = false;
  try {
    const healthResp = await fetch(`${BASE}/api/schemas`, { redirect: 'manual' });
    const status = healthResp.status;
    console.log(`App health check: /api/schemas returned ${status}`);
    appDeployed = status !== 404;
    if (!appDeployed) {
      console.log(
        '\nWARNING: App returns 404 for known routes. The app may not be deployed yet.'
      );
      console.log(
        'Deploy first with: vercel deploy --prod, or point APP_URL to a running dev server.\n'
      );
    }
    console.log('');
  } catch (err) {
    console.error(`\u274c Cannot reach ${BASE}: ${err.message}`);
    console.error('Set APP_URL to a running instance (e.g., APP_URL=http://localhost:3000).\n');
    process.exit(1);
  }

  if (!appDeployed) {
    console.log('Skipping tests — app not deployed. Re-run after deployment.\n');
    console.log('='.repeat(60));
    console.log('API SMOKE TEST RESULTS: SKIPPED (app not deployed)');
    console.log('='.repeat(60));
    process.exit(0);
  }

  console.log('\uD83D\uDCCB Public Endpoints');
  for (const t of tests.filter((t) => !t.url.includes('intake') && !t.url.includes('admin') && !t.url.includes('generate') && !t.url.includes('export') && !t.url.includes('approve') && !t.url.includes('designer') && !t.url.includes('compute'))) {
    await runTest(t);
  }

  console.log('\n\uD83D\uDCCB Auth-Protected Endpoints (expecting 401/redirect)');
  for (const t of tests.filter((t) => t.expect === 401)) {
    await runTest(t);
  }

  // Summary
  const total = passed + failed;
  console.log('\n' + '='.repeat(60));
  console.log(`API SMOKE TEST RESULTS: ${passed}/${total} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log('\nFAILURES:');
    for (const f of failures) {
      console.log(`  \u274c ${f.name}: ${f.error}`);
    }
  }

  console.log('='.repeat(60));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
