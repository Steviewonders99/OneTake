# Centric Creative OS Pipeline — Design Spec

**Date:** 2026-03-27
**Author:** Steven Junop + Claude
**Status:** Draft — awaiting review

## Overview

A 5-stage AI creative generation pipeline for OneForma/Centific **contributor recruitment** marketing. OneForma is a data annotation company — their clients (OpenAI, Anthropic, etc.) need high-quality training data, and OneForma recruits global contributors to annotate, transcribe, segment, and create curated verified data. The "jobs" are contributor tasks (voice segmentation, image annotation, text labeling, data collection), NOT traditional corporate roles.

Recruiting team submits an intake form describing a project/task → the pipeline generates a complete multi-platform ad package with culturally authentic imagery of relatable contributors, evaluated copy in the target language, and platform-specific layouts — all gated by verification at every stage.

**Architecture:** Option C — Vercel frontend (Next.js 16) + local VYRA Creative API sidecar (FastAPI on Mac, MLX models on Apple Silicon). Kimi K2.5 channel research via OpenRouter API.

## OneForma Business Model (Critical Context)

**What OneForma does:**
1. AI companies (OpenAI, Anthropic, Google, etc.) need high-quality training data
2. OneForma/Centific finds people worldwide to annotate, transcribe, segment, and verify data
3. Contributors work remotely, flexible hours, paid per hour/task
4. Tasks span 35+ languages across every continent

**What the ads recruit for (examples):**
- "Cosmos — Voice Assistance Interaction Segmentation" (listen to voice assistant conversations, segment into exchanges, label speaker turns, transcribe)
- Image annotation tasks (label objects, bounding boxes, quality assessment)
- Text labeling (sentiment, intent, entity extraction)
- Data collection (photos, voice recordings, handwriting samples)
- Guided feedback for AI models (RLHF-style evaluation)

**Target contributors (NOT traditional job seekers):**
- Gig workers, students, stay-at-home parents, freelancers
- Multilingual people in 35+ countries
- Looking for: flexible remote work, extra income, meaningful AI work
- Demographics: diverse ages (18-55), often younger (20-35), tech-comfortable
- Motivations: earn from home, flexible schedule, contribute to AI, use language skills

**Value propositions for ads:**
- "Earn money from home using your language skills"
- "Shape the future of AI — one annotation at a time"
- "Flexible hours, work when you want"
- "Join 500K+ contributors worldwide"
- "No degree required — just your language and attention to detail"
- "Get paid to listen, label, and improve AI"

**This changes the creative approach:**
- Actor imagery = regular people at home with laptops, headphones, coffee — NOT corporate offices
- Copy tone = accessible, inviting, opportunity-focused — NOT corporate/professional
- CTA = "Start earning" / "Join now" / "Sign up as a contributor" — NOT "Apply for this role"
- Channels = social media, messaging apps, freelancer communities — NOT just LinkedIn/Indeed

## Architecture

```
VERCEL (Frontend + API Proxy)              LOCAL MAC (VYRA Creative API)
┌──────────────────────────────┐          ┌──────────────────────────────┐
│ Next.js 16 App Router        │          │ FastAPI Server               │
│ ├── Dashboard UI             │   HTTP   │ ├── Seedream 4.5 (image gen) │
│ ├── Intake Form              │─────────>│ ├── Qwen3-VL-8B (visual QA) │
│ ├── Detail/Approval View     │          │ ├── Qwen3.5-9B (orchestrator)│
│ ├── Designer Magic Link      │          │ ├── Gemma 3 12B (copy writer)│
│ ├── /api/intake/* (CRUD)     │          │ ├── Compositor (HTML→PNG)    │
│ ├── /api/generate/* (proxy)  │          │ ├── Evaluator (7-dim gate)   │
│ └── /api/research/* (OpenRouter)        │ └── Font Cache (OneForma)    │
│                              │          │                              │
│ Neon Postgres (data)         │          │ MLX on Apple Silicon         │
│ Clerk (auth + MS SSO)        │          │ GPU-locked, thread-safe      │
│ Vercel Blob (asset storage)  │          └──────────────────────────────┘
│ OpenRouter (Kimi K2.5)       │
└──────────────────────────────┘
```

### Communication Pattern

1. Vercel API route receives intake form data
2. For Stage 1 (brief + research): Next.js calls OpenRouter (Kimi K2.5) directly + proxies to VYRA for Qwen3.5-9B brief generation
3. For Stages 2-4 (image gen, copy, layout): Next.js proxies to VYRA Creative API at `VYRA_API_URL` (e.g., `http://localhost:8000` or ngrok tunnel for remote)
4. Generated images uploaded to Vercel Blob, metadata stored in Neon
5. Status updates pushed to UI via polling (v1) or SSE (v2)

### Environment Variables

```
# Vercel (.env.local)
VYRA_API_URL=http://localhost:8000          # Local VYRA sidecar
OPENROUTER_API_KEY=sk-or-...               # For Kimi K2.5 channel research
DATABASE_URL=postgresql://...               # Neon Postgres
BLOB_READ_WRITE_TOKEN=vercel_blob_...      # Vercel Blob
CLERK_SECRET_KEY=sk_...                     # Clerk auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

---

## The 5-Stage Pipeline

### Stage 1: Strategic Intelligence

**Purpose:** Generate creative brief, messaging strategy, target audience definition, channel research with regional intelligence, and design direction — all verified before any creative work begins.

**Models used:**
- Qwen3.5-9B (via VYRA API) — brief, messaging, audience, design direction
- Kimi K2.5 (via OpenRouter) — web-grounded channel research per region

#### Stage 1a: Creative Brief Generation (Qwen3.5-9B)

**Input:** Intake form data (project/task name, task type, target languages/regions, urgency, task description, skills needed, commitment level, compensation model, special instructions)

**Output:**
```json
{
  "campaign_objective": "Recruit French/Arabic-speaking contributors in Morocco for Cosmos Voice Segmentation project",
  "project_context": {
    "project_name": "Cosmos — Voice Assistance Interaction Segmentation",
    "task_type": "audio_annotation",
    "task_description": "Listen to voice assistant conversations, segment into exchanges, label speaker turns, transcribe user speech",
    "skills_needed": ["Active listening", "Attention to detail", "Language fluency", "Transcription"],
    "commitment": "4-5 hours/day minimum, flexible scheduling",
    "compensation": "Fixed rate per hour"
  },
  "messaging_strategy": {
    "primary_message": "Earn money from home by helping shape the future of AI",
    "value_propositions": [
      "Flexible hours — work when it suits you",
      "Work from home, no commute needed",
      "Help build the AI systems millions of people use",
      "Use your language skills to earn extra income",
      "Join 500K+ contributors worldwide"
    ],
    "tone": "Friendly, inviting, opportunity-focused — NOT corporate"
  },
  "target_audience": {
    "persona": "Young multilingual Moroccan, 20-35, tech-comfortable",
    "profile_types": [
      "University student looking for flexible side income",
      "Stay-at-home parent wanting remote work",
      "Freelancer between gigs",
      "Recent graduate exploring opportunities"
    ],
    "motivations": ["Extra income", "Flexible schedule", "Work from home", "Meaningful work in AI"],
    "pain_points": ["Limited local job opportunities", "Need flexible hours", "Want remote work", "Underemployed despite language skills"]
  },
  "content_language": {
    "primary": "fr",
    "secondary": "ar",
    "rationale": "Morocco: French dominant in tech/professional, Arabic for broader reach"
  }
}
```

#### Stage 1b: Channel Research (Kimi K2.5 via OpenRouter)

**Input:** Country, job type, target demographics from 1a

**OpenRouter API call:**
```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'moonshotai/kimi-k2.5',
    messages: [{
      role: 'system',
      content: 'You are a recruitment marketing channel strategist with deep knowledge of regional job markets, social media penetration, and digital advertising platforms worldwide.'
    }, {
      role: 'user',
      content: `Research the most effective recruitment advertising channels for hiring a ${roleTitle} in ${country}. Consider: local job platforms, social media usage, messaging apps, professional networks. Provide channel recommendations with estimated effectiveness percentages and cite your sources.`
    }]
  })
});
```

**Output:**
```json
{
  "channels": [
    {
      "platform": "LinkedIn",
      "format_types": ["in_feed", "carousel"],
      "effectiveness_pct": 38,
      "rationale": "Primary professional network in Morocco, 2.8M users",
      "sources": ["LinkedIn Economic Graph 2025", "Statista Morocco Digital"]
    },
    {
      "platform": "Telegram",
      "format_types": ["image_card"],
      "effectiveness_pct": 22,
      "rationale": "Growing tech community in Morocco, IT-specific groups",
      "sources": ["Datareportal Morocco 2026"]
    },
    {
      "platform": "Facebook",
      "format_types": ["in_feed", "stories"],
      "effectiveness_pct": 20,
      "rationale": "Highest social media penetration in Morocco (73%)",
      "sources": ["Meta Business Suite Morocco Insights"]
    },
    {
      "platform": "Bayt.com",
      "format_types": ["banner"],
      "effectiveness_pct": 15,
      "rationale": "Leading MENA job board, strong in Morocco tech",
      "sources": ["Bayt.com MENA Job Market Report 2025"]
    },
    {
      "platform": "Indeed Morocco",
      "format_types": ["banner"],
      "effectiveness_pct": 5,
      "rationale": "Secondary reach, lower tech penetration",
      "sources": ["Indeed Hiring Lab EMEA"]
    }
  ],
  "format_matrix": {
    "linkedin": ["in_feed_1200x627", "carousel_1080x1080"],
    "telegram": ["image_card_1280x720"],
    "facebook": ["feed_1080x1080", "stories_1080x1920"],
    "bayt": ["banner_1200x628"],
    "indeed": ["banner_1200x628"]
  }
}
```

#### Stage 1 Gate: Strategic Evaluation (Qwen3.5-9B)

The evaluation agent reviews the complete Stage 1 output:

1. **Fact-check external sources** — Are the cited sources real? Are the statistics plausible?
2. **Realistic feasibility eval** — Given budget constraints, team size (Steven + designer), and timeline, is this brief achievable?
3. **Channel validation** — Are recommended platforms actually available and used for job ads in the target region? (e.g., LinkedIn is accessible in Morocco but blocked in some countries)
4. **Audience definition specificity** — Is the persona specific enough to drive creative decisions?
5. **Language check** — Is the content language appropriate for the target region and platform?

**Pass threshold:** Overall score >= 0.85. Failed dimensions enter amend loop (max 3 cycles).

#### Stage 1c: Design Direction (Qwen3.5-9B)

**Input:** Approved brief + OneForma brand guidelines

**Output:**
```json
{
  "visual_style": "light_clean",
  "color_treatment": "OneForma charcoal (#32373C) primary, accent gradient for highlights",
  "photography_direction": "Authentic workplace, Moroccan coworking space, natural light",
  "template_preferences": {
    "linkedin_feed": "BOTTOM_BAND",
    "linkedin_carousel": ["COVER", "STAT", "FEATURE", "TESTIMONIAL", "CTA"],
    "facebook_feed": "HERO_HEADLINE",
    "facebook_stories": "CENTERED_OVERLAY",
    "telegram": "MINIMAL_CTA"
  },
  "gradient_usage": "Accent only — progress bars, status indicators, not backgrounds",
  "brand_elements": {
    "logo_position": "bottom-left",
    "logo_variant": "color on white, white on dark overlays",
    "font_family": "system-ui (matches OneForma site)"
  }
}
```

---

### Stage 2: Character-Driven Image Generation

**Purpose:** Generate photorealistic, culturally authentic images of relatable characters using the UGC actor system with 10 realism anchors.

**Models used:**
- Qwen3.5-9B (via VYRA) — actor identity card generation + image prompt crafting
- Seedream 4.5 (via VYRA) — image generation
- Qwen3-VL-8B (via VYRA) — visual QA + cultural authenticity + realism validation

#### Stage 2a: Actor Creation (Qwen3.5-9B)

**Input:** Target audience from Stage 1 (persona, region, demographics)

**Output:** Actor Identity Card(s)
```json
{
  "actors": [
    {
      "name": "Youssef",
      "face_lock": {
        "skin_tone_hex": "#8B6914",
        "eye_color": "dark brown",
        "jawline": "defined, youthful",
        "hair": "short dark curly fade",
        "nose_shape": "broad bridge, natural",
        "age_range": "24-28",
        "distinguishing_marks": "light stubble, warm confident smile"
      },
      "prompt_seed": "Young proud Moroccan man, 26, warm brown skin tone #8B6914, short dark curly fade haircut, defined jawline, broad nose bridge, light stubble, warm confident smile, natural confident expression, slight asymmetry in smile, real skin texture with visible pores on nose and forehead",
      "outfit_variations": {
        "at_home_working": "casual t-shirt, headphones on, laptop on kitchen table, focused on screen, mint tea beside laptop",
        "at_home_relaxed": "comfortable hoodie, sitting on couch with laptop, afternoon light through window",
        "cafe_working": "casual button-up, Moroccan cafe with mosaic tiles, laptop and earbuds, mint tea",
        "celebrating_earnings": "casual outfit, phone in hand showing notification, genuine smile of satisfaction"
      },
      "signature_accessory": "over-ear headphones (key tool for audio annotation work)",
      "backdrops": [
        "Moroccan home — kitchen table with laptop, tea, charger cable, lived-in feel",
        "Bedroom desk setup — single monitor, headphones, warm lamp, window with Casablanca cityscape",
        "Moroccan cafe — mosaic tiles, laptop open, earbuds, mint tea glass",
        "Living room couch — laptop on lap, afternoon sunlight, comfortable blanket"
      ]
    },
    {
      "name": "Amina",
      "face_lock": {
        "skin_tone_hex": "#A0784C",
        "eye_color": "dark brown, expressive",
        "jawline": "soft, oval face",
        "hair": "dark wavy, sometimes covered with hijab (optional per variant)",
        "nose_shape": "delicate, slightly upturned",
        "age_range": "25-29",
        "distinguishing_marks": "small beauty mark near left eye, genuine laugh lines"
      },
      "prompt_seed": "Young Moroccan woman, 27, warm olive-brown skin tone #A0784C, dark wavy hair, oval face, expressive dark brown eyes, small beauty mark near left eye, genuine warm expression, real skin texture, natural under-eye shadows",
      "outfit_variations": {
        "at_home_working": "comfortable sweater, headphones on, sitting at desk with laptop, annotation interface on screen",
        "at_home_relaxed": "casual top with hijab, laptop on dining table, morning light, tea and snack nearby",
        "studying_and_working": "university hoodie, library or study room, laptop with earbuds, textbooks nearby",
        "celebrating_earnings": "colorful casual outfit, phone showing payment notification, happy expression"
      },
      "signature_accessory": "wireless earbuds (practical for audio tasks)",
      "backdrops": [
        "Moroccan home — clean dining table with laptop, plants, natural light, family photos on wall",
        "Student room — desk with laptop, textbooks stacked, warm lamp, tea",
        "Balcony workspace — laptop on small table, Moroccan cityscape behind, morning light",
        "Living room — comfortable chair with laptop, headphones, cozy setting"
      ]
    }
  ]
}
```

#### Stage 2b: Image Generation (Seedream 4.5)

**Input:** Actor prompt seed + outfit variation + backdrop + 10 realism anchors

The image prompt is constructed by Qwen3.5-9B combining:
1. Actor prompt seed (face lock + distinguishing marks)
2. Selected outfit variation (based on ad context)
3. Backdrop from actor's backdrop list
4. **Mandatory realism anchor instructions:**

```
REALISM ANCHORS (apply ALL 10 to every generation):
1. SKIN PORES: Visible on forehead, nose, cheeks. Never smooth or airbrushed.
2. STRAY HAIRS: Baby hairs at temples, flyaways catching backlight, imperfect part line.
3. UNDER-EYE TEXTURE: Slight shadows, fine lines, natural discoloration.
4. UNEVEN SKIN TONE: Natural variation, not color-corrected. Real blemishes OK.
5. FABRIC TEXTURE: Visible weave, wrinkles where body bends, pilling on worn fabrics.
6. ENVIRONMENTAL NOISE: Real objects in scene — charger cable, water bottle, earbuds, sticky notes, coffee cup.
7. LIGHTING IMPERFECTIONS: Mixed color temperatures, window overexposure, wall color cast.
8. CAMERA ARTIFACTS: Shallow noise, edge softness, chromatic aberration, slight motion blur. iPhone selfie aesthetic.
9. NAIL DETAIL: Natural ridges, cuticles visible if hands shown.
10. JEWELRY PHYSICS: Watch/necklace catches light unevenly, chains drape with gravity.

ANTI-PATTERNS (block these):
- No perfect facial symmetry
- No uniform studio lighting
- No stock-photo poses (arms crossed, thumbs up)
- No plastic/airbrushed skin
- No floating objects or melted text
- No extra fingers or limbs
```

**Camera simulation:** Selfie (for stories/social), rear cam (for workplace shots), overhead (for desk setups)

**Output:** Base image URL(s) — one per actor × outfit combination needed

#### Stage 2c: Visual QA Gate (Qwen3-VL-8B)

Qwen3-VL reviews each generated image against three rubrics:

**Cultural Authenticity:**
- Does the person look like they belong in the target region?
- Are environmental details culturally appropriate? (Moroccan cafe, not generic American office)
- Is the setting relatable to the target demographic?

**Realism Check (10 anchors):**
- Skin texture present (not airbrushed)?
- Lighting imperfections present?
- Environmental noise present?
- No AI tell-tales (extra fingers, melted text, impossible reflections)?

**Marketing Effectiveness:**
- Aspirational but relatable?
- Emotional resonance with target audience?
- Platform-appropriate composition?

**Pass threshold:** Score >= 0.85. Failed images regenerate with VL feedback (max 3 cycles).

---

### Stage 3: Copy Generation

**Purpose:** Generate recruitment ad copy in the target language, adapted per channel and format, with evaluation.

**Model:** Gemma 3 12B (via VYRA API)

#### Input
- Approved brief from Stage 1 (messaging strategy, value props, tone)
- Target language(s) from Stage 1 (e.g., French primary, Arabic secondary)
- Channel list from Stage 1 (e.g., LinkedIn, Telegram, Facebook, Bayt)
- Actor context from Stage 2 (for narrative-style copy: "Youssef landed his dream AI role...")

#### Output (per channel × language)
```json
{
  "channel": "facebook",
  "language": "fr",
  "variants": [
    {
      "headline": "Gagnez de chez vous avec l'IA",
      "description": "Utilisez vos competences linguistiques. Horaires flexibles. Paiement a l'heure.",
      "primary_text": "Youssef gagne un revenu supplementaire depuis son salon a Casablanca. Il ecoute, il annote, il aide a construire l'IA de demain.",
      "cta": "Commencer maintenant",
      "rationale": "Relatable narrative (Youssef at home) + concrete benefit (earn from home) + aspirational (build AI)"
    },
    {
      "headline": "Vos langues valent de l'or",
      "description": "Transcrivez, annotez, gagnez. Rejoignez 500K+ contributeurs OneForma.",
      "primary_text": "Amina utilise son francais et son arabe pour aider l'IA a mieux comprendre. Flexible, depuis chez elle, a son rythme.",
      "cta": "S'inscrire gratuitement",
      "rationale": "Language skills = value hook + social proof (500K contributors) + flexibility"
    }
  ]
}
```

**Copy constraints (contributor recruitment):**
- Headlines: max 30 chars, speak to the BENEFIT (earn, flexibility, skills) not the company
- Descriptions: max 90 chars, highlight ONE concrete benefit
- Primary text: 125 chars, open with relatable scenario using actor name
- CTA: "Start earning" / "Sign up free" / "Join now" (localized) — NOT "Apply for this role"
- TONE: Friendly, accessible, opportunity-focused — like talking to a friend about a side gig
- AVOID: corporate jargon, "we are seeking", passive voice, degree requirements, intimidating language
- MUST INCLUDE: at least one of: flexibility, work-from-home, language skills, earning potential

#### Stage 3 Gate: Copy Evaluation (Qwen3.5-9B)

| Dimension | Threshold | What's Checked |
|-----------|-----------|----------------|
| candidate_hook | 0.65 | Would a job seeker stop scrolling? |
| readability | 0.70 | Clear, concise, scannable, no jargon |
| cta_clarity | 0.70 | Is the apply action clear and compelling? |
| platform_fit | 0.75 | Copy length/format suits the specific platform |
| language_quality | 0.70 | Natural fluency in target language, not machine-translated |

**Pass threshold:** Overall >= 0.70. Failed copy enters amend loop (max 3 cycles).

---

### Stage 4: Layout Generation (Multi-Platform x Multi-Format)

**Purpose:** Compose approved images + approved copy into platform-specific ad creatives across all formats determined in Stage 1.

**Models:**
- Qwen3.5-9B (via VYRA) — template selection per format
- Compositor (VYRA) — HTML/CSS overlay assembly
- Playwright (VYRA) — headless render to PNG

#### Format Matrix (Dynamic from Stage 1)

The format matrix is NOT hardcoded — it's determined by Stage 1 channel research. Example for Morocco:

| Channel | In-Feed | Story | Carousel | Image Card | Banner |
|---------|---------|-------|----------|------------|--------|
| LinkedIn | 1200x627 | -- | 1080x1080 (5 panels) | -- | -- |
| Facebook | 1080x1080 | 1080x1920 | 1080x1080 (5 panels) | -- | -- |
| Telegram | -- | -- | -- | 1280x720 | -- |
| Bayt.com | -- | -- | -- | -- | 1200x628 |
| Indeed | -- | -- | -- | -- | 1200x628 |

#### Overlay Templates (9 types, from VYRA)

| Template | Best For | Description |
|----------|----------|-------------|
| HERO_HEADLINE | In-feed ads | Full-bleed image + headline + CTA bottom |
| SPLIT_LEFT_TEXT | Banners | Left text panel + right image |
| SPLIT_RIGHT_TEXT | Banners | Left image + right text panel |
| BOTTOM_BAND | LinkedIn feed | Image top + gradient band bottom |
| TOP_BAND | Alternate layout | Gradient band top + image bottom |
| CENTERED_OVERLAY | Stories, TikTok | Image bg + centered text overlay |
| CAROUSEL_STAT | Carousel panels | Big number + label ("300+ languages") |
| CAROUSEL_TESTIMONIAL | Carousel panels | Employee quote + avatar |
| MINIMAL_CTA | Telegram, minimal | Image + small CTA chip |

#### Carousel Panel Sequence (Recruitment-Adapted)

Default 5-panel sequence (contributor recruitment):
1. **COVER** — Actor (Youssef) with headphones at home, "Earn from home with AI" + OneForma branding
2. **STAT** — "500K+ contributors" / "35+ languages" / "Flexible hours"
3. **FEATURE** — How it works: "Listen. Label. Earn." / "Use your language skills" / "No degree needed"
4. **TESTIMONIAL** — Actor (Amina) quote: "I earn extra income between classes using my French and Arabic"
5. **CTA** — "Start earning today" + sign-up link + OneForma logo

#### Composition Props

Each creative variant gets a `CompositionProps` object:
```json
{
  "hero_image_url": "https://vyra-local/generated/youssef-casual-office.png",
  "template": "BOTTOM_BAND",
  "platform": "linkedin_single",
  "headline": "L'IA qui parle 300+ langues",
  "subheadline": "Rejoignez OneForma",
  "cta_text": "Postuler maintenant",
  "brand": {
    "primary_color": "#32373C",
    "secondary_color": "#F5F5F5",
    "accent_color": "rgb(6,147,227)",
    "text_color": "#FFFFFF",
    "font_family": "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
    "logo_url": "https://blob.vercel-storage.com/oneforma-logo.svg",
    "logo_position": "bottom-left"
  },
  "visual_style": "light_clean",
  "gradient_opacity": 0.65
}
```

#### Stage 4 Gate: Creative Evaluation (7 Dimensions)

| Dimension | Threshold | Recruitment Adaptation |
|-----------|-----------|----------------------|
| employer_brand_fit | 0.70 | Matches OneForma voice, culture-forward |
| candidate_hook | 0.65 | Would a job seeker stop scrolling? |
| readability | 0.70 | Clear, scannable text with good contrast |
| visual_text_harmony | 0.60 | Template + style complement copy |
| application_cta | 0.70 | "Apply Now" action is clear and compelling |
| platform_compliance | 0.75 | Dimensions, text length, safe margins correct |
| culture_proof | 0.50 | Feels authentic, not corporate stock |

**Overall pass threshold:** 0.70. Failed dimensions enter amend loop (max 3 cycles).

---

### Stage 5: Surface & Distribute

**Purpose:** Upload approved creatives, store metadata, notify stakeholders, and present for approval.

#### 5a: Asset Upload
- All approved PNGs uploaded to Vercel Blob
- Blob URLs stored in `generated_assets` table in Neon
- Each asset tagged with: request_id, platform, format, language, evaluation scores

#### 5b: Status Update
- `intake_requests.status` updated to `review`
- `intake_requests.updated_at` set to current timestamp

#### 5c: Notification
- **Slack webhook:** Message to designated channel with request summary + preview link
- **Outlook email (Microsoft Graph):** Email to designer with download link
- Both notifications include: role title, urgency, number of creatives generated, approval link

#### 5d: Approval UI
Steven's detail view (`/intake/[id]`) displays:

1. **Creative Brief** — from Stage 1 (messaging, audience, channels with sources)
2. **Channel Strategy** — ranked channels with effectiveness %, cited sources
3. **Actor Profiles** — identity cards for generated characters
4. **Creatives Grid** — grouped by channel x format:
   - LinkedIn: feed variant, carousel (5 panels)
   - Facebook: feed variant, stories variant
   - Telegram: image card
   - Etc.
5. **Evaluation Scores** — per creative, per dimension, visual progress bars
6. **Actions:**
   - "Approve" (green) → triggers designer notification + moves to "approved"
   - "Request Changes" (orange) → adds note, moves back to "generating" for re-run
   - "Reject" (red) → marks as rejected with reason

#### 5e: Designer Magic Link
- Generated on approval, no account needed
- URL format: `/designer/[request_id]?token=[magic_token]`
- Token expires in 7 days
- Designer can: view all creatives, download individual or ZIP, upload refined versions

#### 5f: Agency Export (ZIP)
On final approval after designer refinement:
- **PNGs:** All creatives organized by channel/format folders
- **Brief PDF:** Creative brief from Stage 1
- **Copy CSV:** All headlines, descriptions, CTAs per channel/language
- **Targeting specs:** Audience definition, channel recommendations, budget allocation
- **Evaluation report:** Scores per creative for quality documentation

---

## Database Schema

```sql
-- Intake requests from recruiting team (contributor recruitment)
CREATE TABLE intake_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  task_type       TEXT CHECK (task_type IN ('audio_annotation', 'image_annotation', 'text_labeling', 'data_collection', 'guided_feedback', 'transcription', 'other')),
  task_description TEXT,
  target_languages TEXT[],
  target_regions  TEXT[],
  skills_needed   TEXT[],
  commitment_level TEXT CHECK (commitment_level IN ('part_time', 'full_time', 'flexible')),
  compensation_model TEXT CHECK (compensation_model IN ('fixed_hourly', 'per_task', 'per_unit')),
  urgency         TEXT CHECK (urgency IN ('urgent', 'standard', 'pipeline')),
  volume_needed   INT,
  special_notes   TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'review', 'approved', 'sent', 'rejected')),
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 1 output: strategic intelligence
CREATE TABLE creative_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  brief_data      JSONB NOT NULL,
  channel_research JSONB,
  design_direction JSONB,
  content_languages TEXT[],
  evaluation_score FLOAT,
  evaluation_data  JSONB,
  version         INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 2 output: actor identity cards
CREATE TABLE actor_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  face_lock       JSONB NOT NULL,
  prompt_seed     TEXT NOT NULL,
  outfit_variations JSONB,
  signature_accessory TEXT,
  backdrops       TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Generated creative assets (Stages 2-4)
CREATE TABLE generated_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES actor_profiles(id),
  asset_type      TEXT NOT NULL CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel')),
  platform        TEXT NOT NULL,
  format          TEXT NOT NULL,
  language        TEXT DEFAULT 'en',
  content         JSONB,
  copy_data       JSONB,
  blob_url        TEXT,
  evaluation_score FLOAT,
  evaluation_data  JSONB,
  evaluation_passed BOOLEAN DEFAULT FALSE,
  stage           INT NOT NULL,
  version         INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Approval workflow
CREATE TABLE approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  approved_by     TEXT NOT NULL,
  status          TEXT CHECK (status IN ('approved', 'changes_requested', 'rejected')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Designer uploads (refined creatives)
CREATE TABLE designer_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  original_asset_id UUID REFERENCES generated_assets(id),
  file_name       TEXT NOT NULL,
  blob_url        TEXT NOT NULL,
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Magic link tokens for designer access
CREATE TABLE magic_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notification log
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  channel         TEXT CHECK (channel IN ('slack', 'outlook')),
  recipient       TEXT,
  status          TEXT CHECK (status IN ('sent', 'delivered', 'failed')),
  payload         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline execution log (tracks each stage)
CREATE TABLE pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  stage           INT NOT NULL,
  stage_name      TEXT NOT NULL,
  status          TEXT CHECK (status IN ('running', 'passed', 'failed', 'retrying')),
  attempt         INT DEFAULT 1,
  input_data      JSONB,
  output_data     JSONB,
  evaluation_data JSONB,
  duration_ms     INT,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
```

---

## Model Assignment Summary

| Role | Model | Location | Stage |
|------|-------|----------|-------|
| Brief + Messaging + Audience | Qwen3.5-9B | VYRA (local) | 1a |
| Channel Research (web-grounded) | Kimi K2.5 | OpenRouter API | 1b |
| Strategic Eval + Fact-checking | Qwen3.5-9B | VYRA (local) | 1 Gate |
| Design Direction | Qwen3.5-9B | VYRA (local) | 1c |
| Actor Identity Card Generation | Qwen3.5-9B | VYRA (local) | 2a |
| Image Prompt Crafting | Qwen3.5-9B | VYRA (local) | 2b |
| Image Generation | Seedream 4.5 | VYRA (Volcengine API) | 2b |
| Visual QA + Cultural Auth | Qwen3-VL-8B | VYRA (local) | 2c Gate |
| Ad Copy Writing (multilingual) | Gemma 3 12B | VYRA (local) | 3 |
| Copy Evaluation | Qwen3.5-9B | VYRA (local) | 3 Gate |
| Template Selection | Qwen3.5-9B | VYRA (local) | 4 |
| HTML Composition | Compositor | VYRA (local) | 4 |
| PNG Rendering | Playwright | VYRA (local) | 4 |
| Creative Evaluation (7-dim) | Qwen3.5-9B | VYRA (local) | 4 Gate |

---

## API Routes (Next.js)

```
/api/intake
  POST   /api/intake              → Create new intake request
  GET    /api/intake              → List all requests (with filters)
  GET    /api/intake/[id]         → Get request detail
  PATCH  /api/intake/[id]         → Update request (status, notes)
  DELETE /api/intake/[id]         → Delete request

/api/generate
  POST   /api/generate/[id]       → Trigger full pipeline for request
  GET    /api/generate/[id]/status → Get pipeline stage status (polling)
  POST   /api/generate/[id]/retry  → Retry failed stage

/api/generate/stages (proxy to VYRA)
  POST   /api/generate/[id]/brief        → Stage 1a: Generate brief
  POST   /api/generate/[id]/research     → Stage 1b: Channel research (OpenRouter)
  POST   /api/generate/[id]/evaluate     → Stage 1 Gate: Evaluate brief
  POST   /api/generate/[id]/actors       → Stage 2a: Generate actor cards
  POST   /api/generate/[id]/images       → Stage 2b+2c: Generate + QA images
  POST   /api/generate/[id]/copy         → Stage 3: Generate + evaluate copy
  POST   /api/generate/[id]/compose      → Stage 4: Layout + evaluate creatives

/api/approve
  POST   /api/approve/[id]        → Approve request
  POST   /api/approve/[id]/changes → Request changes

/api/designer
  GET    /api/designer/[id]       → Validate magic link + get assets
  POST   /api/designer/[id]/upload → Upload refined creative

/api/export
  GET    /api/export/[id]         → Generate and download ZIP package

/api/notify
  POST   /api/notify/[id]/slack   → Send Slack notification
  POST   /api/notify/[id]/outlook → Send Outlook notification
```

---

## Phased Implementation

### Phase 1: Foundation (March 27-28)
- Neon database setup with full schema (8 tables)
- CRUD API routes for intake requests
- Replace mock data with real Postgres queries
- Wire existing UI to real data
- VYRA API health check endpoint

### Phase 2: Pipeline Core (March 29-30)
- Stage 1: Brief generation + OpenRouter Kimi K2.5 research + evaluation gate
- Stage 2: Actor creation + Seedream image gen + Qwen3-VL QA gate
- Stage 3: Copy generation + evaluation gate
- Pipeline orchestrator (runs stages sequentially, handles retries)
- Pipeline status tracking (pipeline_runs table)

### Phase 3: Layout & Composition (March 31 - April 1)
- Stage 4: Template selection + compositor + Playwright render + evaluation gate
- Multi-format generation (feed, stories, carousel, banner)
- Vercel Blob upload for generated assets
- Updated detail view showing real generated creatives with scores

### Phase 4: Workflow & Distribution (April 2-3)
- Approval workflow (approve / request changes / reject)
- Designer magic link (no-account access)
- Slack webhook notifications
- Outlook email notifications (Microsoft Graph)
- ZIP export for agency

### Phase 5: Polish & Deploy (April 4-5)
- Error handling and edge cases across all stages
- Pipeline retry UI (retry individual failed stages)
- Real Clerk SSO (Microsoft SAML)
- Production Vercel deploy
- VYRA API accessible from Vercel (ngrok tunnel or VPS deploy)

---

## VYRA Code Copy Manifest

Files copied from `/Users/stevenjunop/vyra/` (NEVER modified in VYRA repo):

| VYRA Source | Centric Usage | Adaptation |
|-------------|--------------|------------|
| `apps/api/app/services/optimize/creative_pipeline.py` | Called via HTTP API | Add Stage 1 (brief+research) before existing pipeline |
| `apps/api/app/services/optimize/creative_compositor.py` | Called via HTTP API | Add recruitment templates, OneForma brand kit |
| `apps/api/app/services/optimize/creative_evaluator.py` | Called via HTTP API | Rename dimensions for recruitment |
| `apps/api/app/services/optimize/asset_generator.py` | Called via HTTP API | Add UGC actor system + realism anchors |
| `apps/api/app/services/optimize/font_cache.py` | Called via HTTP API | Cache system fonts (OneForma uses system stack) |
| `apps/api/app/providers/local_llm.py` | Called via HTTP API | No changes needed (Qwen3.5-9B + Gemma 3 12B) |
| `apps/api/app/providers/local_vlm.py` | Called via HTTP API | No changes needed (Qwen3-VL-8B) |
| `packages/llm-engine/vyra_llm/providers/seedream.py` | Called via HTTP API | No changes needed |
| `apps/api/app/services/optimize/creative_intelligence_workflows.py` | Reference only | Adapt Flow 1 (generate) for recruitment |
| `apps/api/app/routes/optimize/creative.py` | Reference for API shape | Build matching Next.js proxy routes |

**Key decision:** We do NOT rewrite VYRA Python in TypeScript. VYRA runs as-is as a local FastAPI server. The Centric Next.js app is a thin API proxy + UI layer that transforms intake data into VYRA API calls and stores/displays results.

---

## Intake Form Fields (Updated for Contributor Recruitment)

The intake form reflects OneForma's actual workflow — recruiting contributors for data annotation projects:

| Field | Type | Example |
|-------|------|---------|
| Project/Task Name | text | "Cosmos — Voice Assistance Interaction Segmentation" |
| Task Type | select | audio_annotation, image_annotation, text_labeling, data_collection, guided_feedback, transcription |
| Task Description | textarea | "Listen to voice assistant conversations, segment into exchanges, label speaker turns, transcribe" |
| Target Languages | multi-select | French, Arabic, English, Spanish, etc. (35+ options) |
| Target Regions | multi-select | Morocco, Egypt, Brazil, India, etc. |
| Skills Needed | tags | Active listening, Attention to detail, Language fluency, Typing speed |
| Commitment Level | select | part_time (4-5hr/day), full_time (8hr/day), flexible (no minimum) |
| Compensation Model | select | fixed_hourly, per_task, per_unit |
| Urgency | button_group | urgent (need contributors THIS WEEK), standard (2 weeks), pipeline (building pool) |
| Volume Needed | number | "200 contributors needed" |
| Special Instructions | textarea | Any specific requirements, cultural notes, equipment needs |

## Success Criteria

1. Recruiting team fills intake form (< 5 minutes)
2. Pipeline generates complete multi-platform ad package (< 10 minutes)
3. Steven reviews with evaluation scores and approves (< 5 minutes)
4. Designer gets notified and downloads package (< 1 minute)
5. Agency receives ZIP with all assets (< 1 minute)
6. **Total: 30 minutes, down from 3-5 days**
7. Every generated asset has a quality score with dimensional breakdown
8. Characters are culturally authentic for the target region — relatable contributors, NOT corporate stock photos
9. Copy is in the correct language for the target market, using accessible/inviting tone
10. Channel recommendations are region-specific with cited sources (Telegram in Russia, WeChat in China, etc.)
11. Ads speak to contributor motivations (earn from home, flexible, meaningful AI work) — NOT traditional job seeker language
