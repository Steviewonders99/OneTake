/**
 * Swap 6 generated images into the live humus-siblings page.
 * Reads the HTML from server, replaces base64 images by index,
 * writes back via aaPanel API.
 *
 * Image index mapping:
 *   0 → OneForma logo (KEEP)
 *   1 → Hero → 1-hero.png
 *   2 → "Read Short Prompts" (KEEP)
 *   3 → "Speak Naturally" (KEEP)
 *   4 → "Basic Facial Expressions" → 2-facial-expressions.png
 *   5 → "Everyday Movements" → 3-everyday-movements.png
 *   6 → "Your session" accordion → 4-session-recording.png
 *   7 → "Onsite vs at home" accordion → 5-at-home-session.png
 *   8 → Bottom CTA → 6-bottom-cta.png
 *   9 → Footer logo (KEEP)
 */
import crypto from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load aaPanel creds
const envContent = readFileSync(join(homedir(), '.oneconnect', '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const AAPANEL_URL = process.env.AAPANEL_URL;
const AAPANEL_API_KEY = process.env.AAPANEL_API_KEY;
const FILE_PATH = '/www/wwwroot/wp.oneforma.com/humus-siblings/index.html';
const IMG_DIR = join(process.cwd(), 'tmp', 'humus-siblings-images');

const REPLACEMENTS = {
  1: '1-hero.png',
  4: '2-facial-expressions.png',
  5: '3-everyday-movements.png',
  6: '4-session-recording.png',
  7: '5-at-home-session.png',
  8: '6-bottom-cta.png',
};

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
  if (!response.ok) throw new Error(`aaPanel error: ${response.status}`);
  return response.json();
}

async function main() {
  console.log('='.repeat(60));
  console.log('IMAGE SWAP — humus-siblings');
  console.log('='.repeat(60));

  // Step 1: Read HTML from server
  console.log('\n[1/3] Reading live HTML...');
  const result = await aaPost('/files?action=GetFileBody', { path: FILE_PATH });
  let html = result.data;
  console.log(`  Read ${(html.length / 1024).toFixed(0)}KB`);

  // Step 2: Find all <img> src="data:image/..." and replace by index
  console.log('\n[2/3] Swapping images...');

  // Match all img tags with base64 src
  const imgRegex = /<img([^>]*?)src="(data:image\/[^"]+)"([^>]*?)>/g;
  let imgIndex = 0;
  let swapCount = 0;

  html = html.replace(imgRegex, (fullMatch, before, oldSrc, after) => {
    const currentIndex = imgIndex++;

    if (REPLACEMENTS[currentIndex]) {
      const fileName = REPLACEMENTS[currentIndex];
      const filePath = join(IMG_DIR, fileName);
      const imgBuffer = readFileSync(filePath);
      const base64 = imgBuffer.toString('base64');
      const newSrc = `data:image/png;base64,${base64}`;

      console.log(`  [${currentIndex}] ${fileName} → ${(imgBuffer.length / 1024).toFixed(0)}KB base64`);
      swapCount++;
      return `<img${before}src="${newSrc}"${after}>`;
    }

    return fullMatch; // keep original
  });

  console.log(`  Swapped ${swapCount}/${Object.keys(REPLACEMENTS).length} images`);
  console.log(`  New HTML size: ${(html.length / 1024).toFixed(0)}KB`);

  // Step 3: Write back
  console.log('\n[3/3] Deploying to server...');
  await aaPost('/files?action=SaveFileBody', {
    path: FILE_PATH,
    data: html,
    encoding: 'utf-8',
  });

  // Save local backup
  writeFileSync(join(process.cwd(), 'tmp', 'humus-siblings-index.html'), html, 'utf-8');

  console.log('  Deployed!');
  console.log(`\n${'='.repeat(60)}`);
  console.log('DONE — https://www.oneforma.com/humus-siblings/');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
