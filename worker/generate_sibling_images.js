/**
 * Generate 6 replacement images for humus-siblings LP
 * using GPT 5.4 Image Gen 2 via OpenRouter.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load worker .env
const envContent = readFileSync(join(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'openai/gpt-5.4-image-2';
const OUT_DIR = join(process.cwd(), 'tmp', 'humus-siblings-images');

const SHARED_STYLE = 'Editorial documentary photography, shot on 35mm film with natural grain. Practical lighting only — overhead fluorescents, window spill, or studio softboxes visible in frame. Muted color palette, slightly desaturated. Subjects have warm genuine smiles — relaxed and natural, not exaggerated or forced. Shallow depth of field, f/1.8. No text, no logos, no watermarks, no artificial glow.';

const IMAGES = [
  {
    name: '1-hero',
    size: '1536x1024',
    prompt: `Two young adult sisters (ages ~22 and ~25) seated side by side on simple chairs in a clean recording studio. One looks slightly off-camera with a soft smile, the other looks toward the lens with a warm, natural smile. They share clear family resemblance — similar bone structure, same dark brown hair — but the older sister is taller with her hair pulled back, the younger has it down past her shoulders. Both wearing plain solid-colored crew neck tops. A softbox light and camera rig are partially visible in the background, slightly out of focus. The mood is calm and focused, like a behind-the-scenes documentary moment. ${SHARED_STYLE}`,
  },
  {
    name: '2-facial-expressions',
    size: '1024x1024',
    prompt: `Close-up of two brothers (ages ~20 and ~24) sitting next to each other in a simple recording setup. One is mid-sentence with a relaxed grin, the other listens with a warm genuine smile. They share similar brow shape and jawline but the older brother has short stubble and a broader build. Both in plain dark t-shirts. Shot from chest up. A boom microphone is slightly visible at the top edge of frame. Overhead practical studio lighting with soft shadows. Candid, not posed. ${SHARED_STYLE}`,
  },
  {
    name: '3-everyday-movements',
    size: '1024x1024',
    prompt: `Two young adult sisters standing in a clean recording space, one mid-gesture as if explaining something with her hands, the other standing relaxed with arms at her sides. They look alike — same hair color, similar facial features — but one is slightly taller and has shorter hair. Both wearing simple solid-colored clothing. A camera on a tripod is visible to the side. Fluorescent overhead light mixed with window light from the left. Documentary feel, natural smiling moment captured between takes. ${SHARED_STYLE}`,
  },
  {
    name: '4-session-recording',
    size: '1024x1024',
    prompt: `Wide shot of two young adult brothers seated across from each other at a simple table in a clean recording studio. A professional video camera on a tripod is pointed at them, a small monitor shows their framing. One brother reads from a tablet on the table with a slight smile, the other waits his turn looking comfortable and happy. Similar features — same dark curly hair, similar nose — but clearly different ages. Practical studio lighting from above, clean white walls. The scene feels real and documentary, like a research study in progress. ${SHARED_STYLE}`,
  },
  {
    name: '5-at-home-session',
    size: '1024x1024',
    prompt: `Two young adult sisters sitting at a dining table in a clean apartment, participating in a remote video recording session. A ring light on a small tripod is set up on the table next to a laptop showing a video call interface. One sister looks at the screen, the other adjusts the ring light. They resemble each other — same face shape, similar coloring — but one has curly hair pulled up, the other has straight hair down. Natural window light from the side, realistic home environment. Relaxed, focused but smiling warmly — enjoying the experience together. ${SHARED_STYLE}`,
  },
  {
    name: '6-bottom-cta',
    size: '1536x1024',
    prompt: `Two young adult siblings (mixed gender — brother and sister, ages ~21 and ~24) walking out of a modern office building together after completing their recording session. Shot from slightly below, they look relaxed and happy, sharing a natural smile as they walk. They share family resemblance — similar eyes and nose shape. The brother is slightly taller. Both in casual solid-colored clothing. Late afternoon golden hour light hitting the building facade behind them. Slight motion blur on their feet suggests natural movement. Cinematic documentary feel. ${SHARED_STYLE}`,
  },
];

async function generateImage(config) {
  console.log(`  Generating ${config.name} (${config.size})...`);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: config.prompt,
        },
      ],
      provider: {
        require_parameters: true,
      },
      image: {
        size: config.size,
        quality: 'low',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`    FAILED (${response.status}): ${errText.substring(0, 300)}`);
    return null;
  }

  const result = await response.json();

  // Images are in message.images array (OpenRouter GPT image model response)
  const message = result.choices?.[0]?.message;
  const images = message?.images;
  if (!images || images.length === 0) {
    console.error(`    FAILED: No images in response`);
    console.error(`    Message keys: ${message ? Object.keys(message).join(', ') : 'null'}`);
    return null;
  }

  const filePath = join(OUT_DIR, `${config.name}.png`);
  const imageBlock = images[0];

  if (imageBlock?.image_url?.url) {
    const url = imageBlock.image_url.url;
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      writeFileSync(filePath, buffer);
      console.log(`    Saved: ${config.name}.png (${(buffer.length / 1024).toFixed(0)}KB)`);
    } else {
      const imgResp = await fetch(url);
      const buffer = Buffer.from(await imgResp.arrayBuffer());
      writeFileSync(filePath, buffer);
      console.log(`    Saved: ${config.name}.png (${(buffer.length / 1024).toFixed(0)}KB)`);
    }
    return filePath;
  }

  console.error(`    FAILED: Unexpected image format`);
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('SIBLING IMAGE GENERATION — GPT 5.4 Image Gen 2');
  console.log('='.repeat(60));
  console.log(`\nModel: ${MODEL}`);
  console.log(`Output: ${OUT_DIR}`);
  console.log(`Images to generate: ${IMAGES.length}\n`);

  const results = [];

  for (const img of IMAGES) {
    const path = await generateImage(img);
    results.push({ name: img.name, path, success: !!path });
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`  ${r.success ? 'OK' : 'FAIL'}  ${r.name}`);
  }
  const successCount = results.filter(r => r.success).length;
  console.log(`\n  ${successCount}/${IMAGES.length} images generated.`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
