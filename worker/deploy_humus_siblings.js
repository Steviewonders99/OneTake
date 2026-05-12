/**
 * Duplicate humus-twins → humus-siblings via aaPanel API.
 *
 * Reads the standalone HTML from the server, rewrites copy
 * (removes "twin" language, repositions to "Lookalike Siblings"),
 * and deploys to /humus-siblings/.
 *
 * Uses the OneConnect AaPanelClient with a modified base path
 * pointing to the WordPress root where humus-twins lives.
 */
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { writeFileSync, mkdirSync } from 'fs';

// Load aaPanel credentials from ~/.oneconnect/.env manually (no dotenv dep)
const envContent = readFileSync(join(homedir(), '.oneconnect', '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

// aaPanel uses self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const AAPANEL_URL = process.env.AAPANEL_URL;
const AAPANEL_API_KEY = process.env.AAPANEL_API_KEY;
// Use the WP root as base (not /join/) since humus-twins is at root level
const BASE_PATH = '/www/wwwroot/wp.oneforma.com/';

function generateToken(apiKey) {
  const requestTime = Math.floor(Date.now() / 1000);
  const keyMd5 = crypto.createHash('md5').update(apiKey).digest('hex');
  const token = crypto.createHash('md5').update(requestTime + keyMd5).digest('hex');
  return { request_token: token, request_time: requestTime };
}

async function aaPost(endpoint, params = {}) {
  const auth = generateToken(AAPANEL_API_KEY);
  const body = new URLSearchParams({ ...auth, ...params });

  const response = await fetch(`${AAPANEL_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`aaPanel API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ─── Copy Rewriting ──────────────────────────────────────────────────────────

function rewriteCopy(html) {
  let h = html;

  // === Title / H1 level ===
  h = h.replaceAll('Twins &amp; Siblings AI Study', 'Siblings AI Study');
  h = h.replaceAll('Twins & Siblings AI Study', 'Siblings AI Study');
  h = h.replaceAll('Identical Twins &amp; Lookalike Siblings Needed', 'Lookalike Siblings Needed');
  h = h.replaceAll('Identical Twins & Lookalike Siblings Needed', 'Lookalike Siblings Needed');

  // === Section headers ===
  h = h.replaceAll('THE ROLE OF TWINS IN AI', 'THE ROLE OF SIBLINGS IN AI');

  // === Body copy (specific long strings first) ===
  h = h.replaceAll(
    'Identical twins share genetics but develop unique vocal tones, expressions, and mannerisms. This controlled variation teaches AI to see what makes each person distinct.',
    'Siblings who look alike share strong genetic overlap yet develop unique vocal tones, expressions, and mannerisms. This natural variation teaches AI to see what makes each person distinct.'
  );
  h = h.replaceAll('Same DNA, subtle differences', 'Shared genetics, subtle differences');

  // === Compensation ===
  h = h.replaceAll('per person — identical twins, all locations', 'per person — all participants, all locations');
  h = h.replaceAll('per person — identical twins', 'per person — all participants');
  h = h.replaceAll('per person &mdash; identical twins, all locations', 'per person &mdash; all participants, all locations');
  h = h.replaceAll(
    'Each participant receives their own $600. Both twins or siblings must complete the session together.',
    'Each participant receives their own $600. Both siblings must complete the session together.'
  );

  // === Eligibility ===
  h = h.replaceAll(
    'Identical twins or same-gender biological siblings who closely resemble each other',
    'Same-gender biological siblings who closely resemble each other'
  );
  h = h.replaceAll('you and your twin or sibling are eligible', 'you and your sibling are eligible');

  // === FAQ ===
  h = h.replaceAll('Do both twins/siblings need to participate?', 'Do both siblings need to participate?');
  h = h.replaceAll(
    'Both twins or siblings must participate together in the same session.',
    'Both siblings must participate together in the same session.'
  );
  h = h.replaceAll('— $600 each for identical twins', '— $600 each');
  h = h.replaceAll('&mdash; $600 each for identical twins', '&mdash; $600 each');

  // === Generic compound phrases (order matters — most specific first) ===
  h = h.replaceAll('your twin or sibling', 'your sibling');
  h = h.replaceAll('Both twins or siblings', 'Both siblings');
  h = h.replaceAll('twins or siblings', 'siblings');
  h = h.replaceAll('Twins or Siblings', 'Siblings');
  h = h.replaceAll('twin or sibling', 'sibling');
  h = h.replaceAll('Twin or Sibling', 'Sibling');
  h = h.replaceAll('twins/siblings', 'siblings');
  h = h.replaceAll('twin/sibling', 'sibling');
  h = h.replaceAll('twins and siblings', 'siblings');
  h = h.replaceAll('Twins and Siblings', 'Siblings');

  // === Remaining standalone "twins" → "siblings" (regex to avoid URLs/slugs) ===
  // Careful: don't replace inside href, src, class attributes or URL paths
  h = h.replace(/(?<![\/\-\w])twins(?![\/\-\w])/gi, (match) => {
    return match[0] === 'T' ? 'Siblings' : 'siblings';
  });

  // Standalone "twin" → "sibling" (singular)
  h = h.replace(/(?<![\/\-\w])twin(?![\/\-\w])/gi, (match) => {
    return match[0] === 'T' ? 'Sibling' : 'sibling';
  });

  // === Meta / Footer ===
  h = h.replaceAll('Twins Study', 'Siblings Study');

  // === Meta description ===
  h = h.replaceAll(
    'Identical twins and lookalike siblings needed',
    'Lookalike siblings needed'
  );

  // === Fix double-replacements ===
  h = h.replaceAll('siblings siblings', 'siblings');
  h = h.replaceAll('Siblings Siblings', 'Siblings');
  h = h.replaceAll('sibling sibling', 'sibling');

  // === Update page title ===
  h = h.replace(
    /<title>[^<]*<\/title>/i,
    '<title>Siblings AI Study \u2014 $600 Each | OneForma</title>'
  );

  // === Update meta description ===
  h = h.replace(
    /(<meta\s+name=["']description["']\s+content=["'])[^"']*["']/i,
    '$1Lookalike siblings needed for a guided AI video study. Earn $600 each. Flexible scheduling."'
  );

  // === Update OG title if present ===
  h = h.replace(
    /(<meta\s+property=["']og:title["']\s+content=["'])[^"']*["']/i,
    '$1Siblings AI Study \u2014 $600 Each | OneForma"'
  );

  // === Update OG description if present ===
  h = h.replace(
    /(<meta\s+property=["']og:description["']\s+content=["'])[^"']*["']/i,
    '$1Lookalike siblings needed for a guided AI video study. Earn $600 each. Flexible scheduling."'
  );

  // === Update canonical URL if present ===
  h = h.replace(
    /(<link\s+rel=["']canonical["']\s+href=["'])[^"']*humus-twins[^"']*["']/i,
    '$1https://www.oneforma.com/humus-siblings/"'
  );

  // === Update OG URL if present ===
  h = h.replace(
    /(<meta\s+property=["']og:url["']\s+content=["'])[^"']*humus-twins[^"']*["']/i,
    '$1https://www.oneforma.com/humus-siblings/"'
  );

  return h;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=' .repeat(60));
  console.log('HUMUS-TWINS → HUMUS-SIBLINGS (via aaPanel)');
  console.log('=' .repeat(60));

  if (!AAPANEL_URL || !AAPANEL_API_KEY) {
    console.error('\nFATAL: Missing AAPANEL_URL or AAPANEL_API_KEY in ~/.oneconnect/.env');
    process.exit(1);
  }

  console.log(`\naaPanel: ${AAPANEL_URL}`);
  console.log(`Base:    ${BASE_PATH}`);

  // Step 1: Read the original humus-twins/index.html
  console.log('\n[1/4] Reading humus-twins/index.html from server...');
  const sourcePath = `${BASE_PATH}humus-twins/index.html`;

  let readResult;
  try {
    readResult = await aaPost('/files?action=GetFileBody', { path: sourcePath });
  } catch (err) {
    console.error(`  ERROR reading file: ${err.message}`);
    console.log('\n  Trying alternate path: /www/wwwroot/wp.oneforma.com/humus-twins/index.html');
    // Maybe it's at a different location
    try {
      readResult = await aaPost('/files?action=GetFileBody', {
        path: '/www/wwwroot/wp.oneforma.com/humus-twins/index.html'
      });
    } catch (err2) {
      console.error(`  Also failed: ${err2.message}`);
      console.log('\n  Listing root to find the file...');
      const dirResult = await aaPost('/files?action=GetDir', {
        path: '/www/wwwroot/wp.oneforma.com/',
        showRow: '200',
      });
      const dirs = (dirResult.DIR || []).map(d => d.name).filter(n => n.includes('humus'));
      console.log(`  Humus directories found: ${dirs.join(', ') || 'NONE'}`);
      process.exit(1);
    }
  }

  const originalHtml = readResult.data;
  if (!originalHtml || originalHtml.length < 100) {
    console.error(`  ERROR: File content is empty or too short (${originalHtml?.length || 0} chars)`);
    console.log('  Raw result:', JSON.stringify(readResult).substring(0, 300));
    process.exit(1);
  }

  console.log(`  Read ${originalHtml.length} chars from humus-twins/index.html`);

  // Step 2: Rewrite copy
  console.log('\n[2/4] Rewriting copy (twin → siblings, broader net)...');
  const newHtml = rewriteCopy(originalHtml);

  // Verify changes were made
  const twinCount = (originalHtml.match(/twin/gi) || []).length;
  const newTwinCount = (newHtml.match(/twin/gi) || []).length;
  console.log(`  "twin" occurrences: ${twinCount} → ${newTwinCount}`);
  console.log(`  File size: ${(originalHtml.length / 1024).toFixed(1)}KB → ${(newHtml.length / 1024).toFixed(1)}KB`);

  // Save local backup
  const backupDir = join(process.cwd(), 'tmp');
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(join(backupDir, 'humus-siblings-index.html'), newHtml, 'utf-8');
  console.log(`  Local backup: tmp/humus-siblings-index.html`);

  // Step 3: Create directory on server
  console.log('\n[3/4] Creating /humus-siblings/ directory on server...');
  const targetDir = `${BASE_PATH}humus-siblings`;
  try {
    await aaPost('/files?action=CreateDir', { path: targetDir });
    console.log(`  Created: ${targetDir}`);
  } catch (err) {
    console.log(`  Directory may already exist: ${err.message}`);
  }

  // Step 4: Write the file
  console.log('\n[4/4] Deploying humus-siblings/index.html...');
  const targetFile = `${BASE_PATH}humus-siblings/index.html`;

  // Create the file first
  try {
    await aaPost('/files?action=CreateFile', { path: targetFile });
  } catch (err) {
    // File might already exist, that's fine
  }

  // Write content
  await aaPost('/files?action=SaveFileBody', {
    path: targetFile,
    data: newHtml,
    encoding: 'utf-8',
  });

  console.log(`  Deployed: ${targetFile}`);
  console.log(`\n${'='.repeat(60)}`);
  console.log('DONE!');
  console.log(`\n  Live URL: https://www.oneforma.com/humus-siblings/`);
  console.log(`  Source:   https://www.oneforma.com/humus-twins/`);
  console.log(`\n  Remaining "twin" refs (in URLs/slugs only): ${newTwinCount}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
