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
const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_wnpLYmD5EHa6@ep-lucky-rice-a8nk2ai4-pooler.eastus2.azure.neon.tech/neondb?sslmode=require";

if (!BLOB_TOKEN) {
  console.error("ERROR: BLOB_READ_WRITE_TOKEN is not set.");
  process.exit(1);
}

const sql = neon(DB_URL);

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
