#!/usr/bin/env node
/**
 * Seed design artifacts: upload SVG/CSS/HTML files to Vercel Blob,
 * then upsert catalog rows into Neon design_artifacts table.
 *
 * Usage: node scripts/seed-design-artifacts.mjs
 * Idempotent: safe to run multiple times (ON CONFLICT DO UPDATE).
 *
 * Env vars needed: BLOB_READ_WRITE_TOKEN, DATABASE_URL
 */

import { readFileSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!BLOB_TOKEN) {
  console.error("ERROR: BLOB_READ_WRITE_TOKEN is not set.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// MIME type helper
// ---------------------------------------------------------------------------

function mimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".css") return "text/css";
  if (ext === ".html") return "text/html";
  return "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Usage snippet templates
// ---------------------------------------------------------------------------

function buildUsageSnippet(entry, blobUrl) {
  switch (entry.category) {
    case "blob":
    case "divider":
    case "badge":
      return `<img src="${blobUrl}" alt="${entry.artifact_id}" class="${entry.css_class}" width="${entry.dimensions.split("x")[0]}" height="${entry.dimensions.split("x")[1]}" />`;
    case "mask":
      return `<div class="${entry.css_class}" style="mask-image: url('${blobUrl}'); -webkit-mask-image: url('${blobUrl}'); mask-size: cover; -webkit-mask-size: cover;"></div>`;
    case "gradient":
      return `/* Import in your CSS: */\n@import url('${blobUrl}');`;
    case "cta":
      return `<!-- Embed via iframe or inline: -->\n<iframe src="${blobUrl}" style="border:none;" title="${entry.artifact_id}"></iframe>`;
    case "card":
      return `<div class="${entry.css_class}" style="position:absolute; top:0; left:0;">\n  <!-- Inline HTML from ${blobUrl} -->\n</div>`;
    case "pattern":
      return `<div class="${entry.css_class}" style="background-image:url('${blobUrl}'); background-repeat:repeat; opacity:0.15; width:100%; height:100%;"></div>`;
    case "device":
      return `<img src="${blobUrl}" alt="${entry.artifact_id}" class="${entry.css_class}" width="${entry.dimensions.split("x")[0]}" height="${entry.dimensions.split("x")[1]}" />`;
    default:
      return blobUrl;
  }
}

// ---------------------------------------------------------------------------
// Artifact manifest
// ---------------------------------------------------------------------------

/** @type {Array<{artifact_id: string, category: string, description: string, file: string, dimensions: string, css_class: string, usage_notes: string, pillar_affinity: string[], format_affinity: string[]}>} */
const ARTIFACTS = [
  {
    artifact_id: "blob_organic_1",
    category: "blob",
    description: "Large organic blob shape for background decoration and section framing",
    file: "blobs/blob_organic_1.svg",
    dimensions: "400x380",
    css_class: "artifact-blob artifact-blob-organic-1",
    usage_notes: "Place behind hero content or section headers. Works well at 40–60% opacity.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "blob_organic_2",
    category: "blob",
    description: "Medium organic blob shape for accent layering and visual balance",
    file: "blobs/blob_organic_2.svg",
    dimensions: "300x280",
    css_class: "artifact-blob artifact-blob-organic-2",
    usage_notes: "Pair with blob_organic_1 for depth. Rotate 180° for variation.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "blob_corner_accent",
    category: "blob",
    description: "Small corner blob accent for edge decoration and layout anchoring",
    file: "blobs/blob_corner_accent.svg",
    dimensions: "180x160",
    css_class: "artifact-blob artifact-blob-corner",
    usage_notes: "Anchor to corners. Use at 20–40% opacity as a subtle framing element.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "divider_curved_wave",
    category: "divider",
    description: "Full-width curved wave section divider for smooth content transitions",
    file: "dividers/divider_curved_wave.svg",
    dimensions: "1080x80",
    css_class: "artifact-divider artifact-divider-wave",
    usage_notes: "Use between content sections. Flip vertically to create enclosure effect.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "divider_arc",
    category: "divider",
    description: "Clean arc divider for minimal section separation",
    file: "dividers/divider_arc.svg",
    dimensions: "1080x60",
    css_class: "artifact-divider artifact-divider-arc",
    usage_notes: "Subtle alternative to wave. Pairs well with flat color sections.",
    pillar_affinity: ["shape"],
    format_affinity: ["linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "mask_blob_egg",
    category: "mask",
    description: "Egg-shaped blob mask for portrait/headshot image cropping",
    file: "masks/mask_blob_egg.svg",
    dimensions: "600x700",
    css_class: "artifact-mask artifact-mask-egg",
    usage_notes: "Apply as CSS mask-image to headshot containers. Portrait-oriented (taller than wide).",
    pillar_affinity: ["shape"],
    format_affinity: ["ig_feed", "linkedin_feed"],
  },
  {
    artifact_id: "mask_blob_organic",
    category: "mask",
    description: "Organic blob mask for lifestyle and landscape image cropping",
    file: "masks/mask_blob_organic.svg",
    dimensions: "700x600",
    css_class: "artifact-mask artifact-mask-organic",
    usage_notes: "Apply as CSS mask-image to lifestyle imagery. Landscape-oriented (wider than tall).",
    pillar_affinity: ["shape", "grow"],
    format_affinity: ["ig_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_icon_globe",
    category: "badge",
    description: "Globe icon badge for global/remote work positioning",
    file: "badges/badge_icon_globe.svg",
    dimensions: "64x64",
    css_class: "artifact-badge artifact-badge-globe",
    usage_notes: "Use near headlines about global opportunities or remote work. Do not resize below 32px.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_icon_briefcase",
    category: "badge",
    description: "Briefcase icon badge for professional/career growth positioning",
    file: "badges/badge_icon_briefcase.svg",
    dimensions: "64x64",
    css_class: "artifact-badge artifact-badge-briefcase",
    usage_notes: "Use near headlines about skills, career growth, or professional development.",
    pillar_affinity: ["shape", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_icon_award",
    category: "badge",
    description: "Award icon badge for achievement/recognition positioning",
    file: "badges/badge_icon_award.svg",
    dimensions: "64x64",
    css_class: "artifact-badge artifact-badge-award",
    usage_notes: "Use near social proof copy (ratings, testimonials, certifications).",
    pillar_affinity: ["shape"],
    format_affinity: ["ig_feed", "linkedin_feed"],
  },
  {
    artifact_id: "gradient_sapphire_pink",
    category: "gradient",
    description: "Sapphire-to-pink gradient CSS for vibrant brand-aligned backgrounds",
    file: "gradients/gradient_sapphire_pink.css",
    dimensions: "CSS",
    css_class: "artifact-gradient artifact-gradient-sapphire-pink",
    usage_notes: "Apply .gradient-sapphire-pink class to container elements. High contrast — ensure white text.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "gradient_light_lavender",
    category: "gradient",
    description: "Soft light-lavender gradient CSS for subtle backgrounds and overlays",
    file: "gradients/gradient_light_lavender.css",
    dimensions: "CSS",
    css_class: "artifact-gradient artifact-gradient-light-lavender",
    usage_notes: "Use for secondary sections or card backgrounds. Works with dark or light text.",
    pillar_affinity: ["shape"],
    format_affinity: ["linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "cta_pill_filled",
    category: "cta",
    description: "Filled pill-shaped CTA button HTML component for primary actions",
    file: "ctas/cta_pill_filled.html",
    dimensions: "auto",
    css_class: "artifact-cta artifact-cta-pill-filled",
    usage_notes: "Use for primary CTA (Apply Now, Get Started). Customize text and href. Always include UTM params.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "cta_pill_outline",
    category: "cta",
    description: "Outline pill-shaped CTA button HTML component for secondary actions",
    file: "ctas/cta_pill_outline.html",
    dimensions: "auto",
    css_class: "artifact-cta artifact-cta-pill-outline",
    usage_notes: "Use for secondary CTAs (Learn More, See Roles). Pair with cta_pill_filled for CTA hierarchy.",
    pillar_affinity: ["shape"],
    format_affinity: ["linkedin_feed", "facebook_feed"],
  },

  // ── Badges (10) ────────────────────────────────────────────────────────────
  {
    artifact_id: "badge_microphone",
    category: "badge",
    description: "Microphone icon badge for audio/voice task and recording work positioning",
    file: "badges/badge_microphone.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about voice, audio annotation, or speech data tasks.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_document",
    category: "badge",
    description: "Document icon badge for content review, transcription, and data entry tasks",
    file: "badges/badge_document.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about document review, annotation tasks, or transcription roles.",
    pillar_affinity: ["earn", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_language",
    category: "badge",
    description: "Language/speech bubble icon badge for multilingual and translation task positioning",
    file: "badges/badge_language.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about language skills, translation tasks, or multilingual opportunities.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_clipboard",
    category: "badge",
    description: "Clipboard icon badge for survey, evaluation, and assessment task positioning",
    file: "badges/badge_clipboard.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about surveys, rating tasks, or quality evaluation roles.",
    pillar_affinity: ["earn", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_camera",
    category: "badge",
    description: "Camera icon badge for image annotation, video, and visual AI task positioning",
    file: "badges/badge_camera.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about image labeling, video annotation, or visual data tasks.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_stethoscope",
    category: "badge",
    description: "Stethoscope icon badge for healthcare AI and medical data task positioning",
    file: "badges/badge_stethoscope.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about medical annotation, health AI training, or clinical data roles.",
    pillar_affinity: ["earn", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_headphones",
    category: "badge",
    description: "Headphones icon badge for listening, audio review, and transcription task positioning",
    file: "badges/badge_headphones.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about audio listening tasks, transcription, or speech evaluation.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_chart",
    category: "badge",
    description: "Chart/graph icon badge for data analysis and AI feedback task positioning",
    file: "badges/badge_chart.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about data insights, AI training contribution, or analytics roles.",
    pillar_affinity: ["grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_dollar",
    category: "badge",
    description: "Dollar/currency icon badge for earnings and pay rate positioning",
    file: "badges/badge_dollar.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about earnings, pay rates, or flexible income opportunities.",
    pillar_affinity: ["earn"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "badge_shield",
    category: "badge",
    description: "Shield icon badge for trust, security, and verified platform positioning",
    file: "badges/badge_shield.svg",
    dimensions: "96x96",
    css_class: "badge-icon",
    usage_notes: "Use near copy about platform legitimacy, secure payments, or contributor protection.",
    pillar_affinity: ["shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },

  // ── Patterns (3) ────────────────────────────────────────────────────────────
  {
    artifact_id: "pattern_dot_grid",
    category: "pattern",
    description: "Subtle dot-grid repeating pattern for background texture on flat color sections",
    file: "patterns/pattern_dot_grid.svg",
    dimensions: "200x200",
    css_class: "pattern-tile",
    usage_notes: "Tile at 10–20% opacity over solid backgrounds to add depth without distraction.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "pattern_diagonal_lines",
    category: "pattern",
    description: "Diagonal line repeating pattern for energetic directional background texture",
    file: "patterns/pattern_diagonal_lines.svg",
    dimensions: "200x200",
    css_class: "pattern-tile",
    usage_notes: "Tile at 8–15% opacity. Effective on gradient backgrounds for added motion feel.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "pattern_concentric_circles",
    category: "pattern",
    description: "Concentric circles repeating pattern for focused, target-like background texture",
    file: "patterns/pattern_concentric_circles.svg",
    dimensions: "200x200",
    css_class: "pattern-tile",
    usage_notes: "Tile at 10–18% opacity. Works well behind hero CTA zones to draw visual focus.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },

  // ── Cards (4) ────────────────────────────────────────────────────────────
  {
    artifact_id: "card_notification",
    category: "card",
    description: "Floating notification card HTML component showing a task assignment alert",
    file: "cards/card_notification.html",
    dimensions: "280x80",
    css_class: "floating-card",
    usage_notes: "Position floating above or beside a lifestyle image. Conveys real-time platform activity.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "card_earnings",
    category: "card",
    description: "Floating earnings card HTML component showing a payment or payout summary",
    file: "cards/card_earnings.html",
    dimensions: "240x100",
    css_class: "floating-card",
    usage_notes: "Place near CTA or hero copy. Reinforces earn pillar with tangible payment figures.",
    pillar_affinity: ["earn"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "card_task_preview",
    category: "card",
    description: "Floating task preview card HTML component showing an available task with pay rate",
    file: "cards/card_task_preview.html",
    dimensions: "260x110",
    css_class: "floating-card",
    usage_notes: "Position near the lower half of creatives. Shows platform UX to drive sign-up curiosity.",
    pillar_affinity: ["earn", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "card_testimonial",
    category: "card",
    description: "Floating testimonial card HTML component showing a contributor quote and avatar",
    file: "cards/card_testimonial.html",
    dimensions: "280x120",
    css_class: "floating-card",
    usage_notes: "Layer over lifestyle imagery to add social proof. Swap quote text per persona campaign.",
    pillar_affinity: ["shape", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },

  // ── Gradients (3) ────────────────────────────────────────────────────────────
  {
    artifact_id: "gradient_bowl_curve",
    category: "gradient",
    description: "Bowl-shaped curved gradient CSS for concave section background effects",
    file: "gradients/gradient_bowl_curve.css",
    dimensions: "CSS",
    css_class: "artifact-gradient gradient-bowl-curve",
    usage_notes: "Apply .gradient-bowl-curve to section containers for a cupped, immersive background feel.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "gradient_diagonal_sweep",
    category: "gradient",
    description: "Diagonal sweep gradient CSS for dynamic angled background transitions",
    file: "gradients/gradient_diagonal_sweep.css",
    dimensions: "CSS",
    css_class: "artifact-gradient gradient-diagonal-sweep",
    usage_notes: "Apply .gradient-diagonal-sweep to full-bleed containers. Ensure text contrast above 4.5:1.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
  {
    artifact_id: "gradient_radial_burst",
    category: "gradient",
    description: "Radial burst gradient CSS for focal glow and spotlight background effects",
    file: "gradients/gradient_radial_burst.css",
    dimensions: "CSS",
    css_class: "artifact-gradient gradient-radial-burst",
    usage_notes: "Center behind hero subjects to create a spotlight feel. High-impact on dark backgrounds.",
    pillar_affinity: ["earn", "grow"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },

  // ── Devices (1) ────────────────────────────────────────────────────────────
  {
    artifact_id: "device_phone_portrait",
    category: "device",
    description: "Portrait phone device frame SVG for in-context mobile app screenshot mockups",
    file: "devices/device_phone_portrait.svg",
    dimensions: "280x560",
    css_class: "device-frame",
    usage_notes: "Layer a platform screenshot inside the screen area. Use at ~40% of creative width.",
    pillar_affinity: ["earn", "grow", "shape"],
    format_affinity: ["ig_feed", "linkedin_feed", "facebook_feed"],
  },
];

// ---------------------------------------------------------------------------
// Upload one artifact to Vercel Blob
// ---------------------------------------------------------------------------

async function uploadArtifact(entry) {
  const filePath = join(__dirname, "artifacts", entry.file);

  if (!existsSync(filePath)) {
    throw new Error(`Artifact file not found: ${filePath}`);
  }

  const fileBuffer = readFileSync(filePath);
  const mime = mimeType(entry.file);
  const blobPath = `design-artifacts/${entry.category}/${basename(entry.file)}`;

  console.log(`  Uploading ${entry.artifact_id} → blob:${blobPath}`);

  const result = await put(blobPath, fileBuffer, {
    access: "public",
    contentType: mime,
    token: BLOB_TOKEN,
    // addRandomSuffix: false keeps the path stable across re-runs
    addRandomSuffix: false,
  });

  return result.url;
}

// ---------------------------------------------------------------------------
// Upsert one row into design_artifacts
// ---------------------------------------------------------------------------

async function upsertArtifact(entry, blobUrl) {
  const usageSnippet = buildUsageSnippet(entry, blobUrl);

  await sql`
    INSERT INTO design_artifacts (
      artifact_id,
      category,
      description,
      blob_url,
      dimensions,
      css_class,
      usage_snippet,
      usage_notes,
      pillar_affinity,
      format_affinity,
      is_active,
      updated_at
    ) VALUES (
      ${entry.artifact_id},
      ${entry.category},
      ${entry.description},
      ${blobUrl},
      ${entry.dimensions},
      ${entry.css_class},
      ${usageSnippet},
      ${entry.usage_notes},
      ${entry.pillar_affinity},
      ${entry.format_affinity},
      true,
      NOW()
    )
    ON CONFLICT (artifact_id) DO UPDATE SET
      category        = EXCLUDED.category,
      description     = EXCLUDED.description,
      blob_url        = EXCLUDED.blob_url,
      dimensions      = EXCLUDED.dimensions,
      css_class       = EXCLUDED.css_class,
      usage_snippet   = EXCLUDED.usage_snippet,
      usage_notes     = EXCLUDED.usage_notes,
      pillar_affinity = EXCLUDED.pillar_affinity,
      format_affinity = EXCLUDED.format_affinity,
      is_active       = EXCLUDED.is_active,
      updated_at      = NOW()
  `;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nSeeding ${ARTIFACTS.length} design artifacts...\n`);

  let uploaded = 0;
  const errors = [];

  for (const entry of ARTIFACTS) {
    try {
      const blobUrl = await uploadArtifact(entry);
      await upsertArtifact(entry, blobUrl);
      console.log(`  [OK] ${entry.artifact_id}`);
      uploaded++;
    } catch (err) {
      console.error(`  [FAIL] ${entry.artifact_id}: ${err.message}`);
      errors.push({ artifact_id: entry.artifact_id, error: err.message });
    }
  }

  // Final count from DB
  const rows = await sql`SELECT COUNT(*) AS total FROM design_artifacts WHERE is_active = true`;
  const totalActive = rows[0]?.total ?? "?";

  console.log(`\n--- Summary ---`);
  console.log(`Uploaded this run : ${uploaded} / ${ARTIFACTS.length}`);
  console.log(`Active in DB      : ${totalActive}`);

  if (errors.length > 0) {
    console.error(`\nFailed (${errors.length}):`);
    for (const e of errors) {
      console.error(`  - ${e.artifact_id}: ${e.error}`);
    }
    process.exit(1);
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
