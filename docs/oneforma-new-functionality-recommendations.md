# OneForma.com — New Functionality, Integrations & Dynamic Content Recommendations

> **Created:** April 28, 2026
> **Author:** Steven Junop (Digital Marketing Manager, Centific / OneForma)
> **Context:** Olivine rebrand (Earn/Grow/Shape pillars), oneforma.com technical audit, Elementor Pro migration, centric-intake pipeline
> **Source Repos:** `/oneformaseo` (rebrand strategy), `/centric-intake` (pipeline), `/OneWeb` (this audit)
> **Status:** Draft — Recommendations for Q2–Q3 2026 roadmap
> **Classification:** Internal — Confidential

---

## Table of Contents

1. [Strategic Context](#1-strategic-context)
2. [New Navigation & Pillar Architecture](#2-new-navigation--pillar-architecture)
3. [Dynamic Content Systems](#3-dynamic-content-systems)
4. [Programmatic SEO Pages](#4-programmatic-seo-pages)
5. [New Integrations](#5-new-integrations)
6. [New Site Functionality](#6-new-site-functionality)
7. [Pipeline Enhancements](#7-pipeline-enhancements)
8. [Content & Community Features](#8-content--community-features)
9. [Analytics & Measurement](#9-analytics--measurement)
10. [Priority Matrix](#10-priority-matrix)
11. [Technical Implementation Notes](#11-technical-implementation-notes)

---

## 1. Strategic Context

### The Rebrand Thesis

OneForma is repositioning from "legacy data services crowd platform" to "the AI platform that sees the expert in everyone." This is operationalized through three pillars:

| Pillar | Audience | JTBD | Current State | Gap |
|---|---|---|---|---|
| **EARN** | Gig Workers (25-44, EU/Asia) | Predictable part-time income | Jobs page exists but undifferentiated | No entry-level hub, no "what to expect" content |
| **GROW** | Career Advancers (18-34, S.Asia/Africa/LatAm) | Skill-building + earnings | Certifications exist but hidden | No skill paths, no progression visibility, no community |
| **SHAPE** | Domain Experts (35-54, EU) | Intellectual contribution + recognition | Domain Expert page exists but thin | No profession-specific pages, no impact stories, NPS is +4.2 (lowest tier) |

### The 4 Olivine Strategic Priorities

1. **Fix Platform Reliability** — Account suspensions, support response (operational, not just marketing)
2. **Lead With Impact, Not Income** — Reframe messaging to expertise-first
3. **Close the Transparency Gap** — Post-project updates, use-case clarity, client feedback
4. **Build Community & Proactive Matching** — Shift from browse → "we find projects for you"

### What the Site Must Deliver

Every recommendation below serves one or more of these goals:
- **Attract** the right persona to the right pillar
- **Convert** visitors to registered experts with pillar-aligned messaging
- **Retain** by demonstrating impact, community, and growth
- **Rank** for intent-matched keyword clusters ($3.8M monthly search demand)

---

## 2. New Navigation & Pillar Architecture

### 2.1 Header Navigation (Replace Current)

**Current:** `How OneForma Works | Domain Experts | Jobs | [Log In] [Join]`

**Recommended:**
```
Logo · Earn · Grow · Shape · For Business · Help · [Sign In] [Put your expertise to work →]
```

**Implementation:** WordPress menu + Elementor Header template. Each pillar item is a mega-menu or simple link to the pillar hub page.

### 2.2 New URL Structure

| URL | Type | Pillar | Content |
|---|---|---|---|
| `/` | Page | All | New homepage with pillar pathways |
| `/earn` | Hub Page | EARN | Entry-level opportunities, "what to expect," featured crowd jobs |
| `/earn/data-annotation-jobs` | Anchor Page | EARN | SEO anchor: "data annotation jobs" (18,100/mo) |
| `/earn/ai-training-jobs` | Anchor Page | EARN | SEO anchor: "ai training jobs" (9,900/mo) |
| `/earn/ai-trainer-jobs` | Anchor Page | EARN | SEO anchor: "ai trainer jobs" (5,400/mo) |
| `/grow` | Hub Page | GROW | Career development, certifications, skill paths |
| `/grow/ai-certification` | Anchor Page | GROW | SEO anchor: "ai certification" (9,900/mo) |
| `/grow/translation-jobs` | Hub | GROW | Translation + MTPE opportunities |
| `/grow/translation-jobs/{language-pair}` | Programmatic | GROW | e.g., `/grow/translation-jobs/english-to-french` |
| `/shape` | Hub Page | SHAPE | Domain Expert Mastery Program hub |
| `/shape/for-physicians` | Programmatic | SHAPE | Profession template |
| `/shape/for-nurses` | Programmatic | SHAPE | Profession template |
| `/shape/for-attorneys` | Programmatic | SHAPE | Profession template |
| `/shape/specialties/{specialty}` | Programmatic | SHAPE | e.g., `/shape/specialties/cardiology` |
| `/for-business` | Hub Page | BIZ | Enterprise content |
| `/for-business/compare/oneforma-vs-{competitor}` | Programmatic | BIZ | Honest comparisons |
| `/stories` | Archive | TRUST | Worker testimonials |
| `/stories/{slug}` | Single | TRUST | Individual worker story |
| `/blog` | Archive | ALL | Editorial hub |
| `/help` | Hub | ALL | Consolidated help center (collapse 3 trees) |
| `/jobs` | Archive | ALL | All jobs (unchanged, add pillar filters) |
| `/jobs/{slug}` | Single | ALL | Individual job (unchanged) |

### 2.3 Implementation: Custom Post Types & Taxonomies to Add

| New CPT/Taxonomy | Type | Purpose |
|---|---|---|
| `worker_story` | CPT | Worker testimonials/success stories |
| `pillar` | Taxonomy on `job` | Assign jobs to Earn/Grow/Shape |
| `profession` | Taxonomy on `job` | Physicians, Nurses, Attorneys, etc. (for /shape/for-{profession}) |
| `specialty` | Taxonomy on `job` | Cardiology, Dermatology, Securities Law, etc. |
| `language_pair` | Taxonomy on `job` | English-to-French, etc. (for translation programmatic pages) |

---

## 3. Dynamic Content Systems

### 3.1 Pillar-Aware Job Display

**Concept:** Jobs are tagged with a `pillar` taxonomy (Earn/Grow/Shape). Each pillar hub page dynamically pulls only its relevant jobs with pillar-specific messaging.

**ACF Fields to Add to `job` CPT:**

| Field Name | Type | Purpose |
|---|---|---|
| `pillar` | Select (Earn/Grow/Shape) | Primary pillar assignment |
| `impact_statement` | Textarea | "Your work improved X by Y%" (Olivine Priority #3) |
| `skills_gained` | Repeater | Skills/certifications earned from this project |
| `pay_range_min` | Number | Minimum hourly rate (for transparency) |
| `pay_range_max` | Number | Maximum hourly rate |
| `time_commitment` | Select | Part-time / Full-time / Flexible / One-time |
| `difficulty_level` | Select | Entry / Intermediate / Expert |
| `project_status` | Select | Actively Hiring / Waitlist / Completed |
| `featured_story` | Post Object (worker_story) | Link to a worker story for this project |

**Elementor Implementation:** Each pillar hub uses an Elementor Posts widget with a taxonomy query filtered to `pillar=earn|grow|shape`. Dynamic Tags pull the new ACF fields for richer job cards.

**Shortcode (for pillar hub pages):**
```
[pillar_jobs pillar="earn" count="6" layout="grid"]
[pillar_jobs pillar="shape" count="3" layout="featured"]
```

### 3.2 Dynamic Stats Engine

**Current:** Static counters (1.8M Members, 300+ Languages, 222 Markets, 20K Projects).

**Recommended:** Pull live stats from the database or a cached API endpoint.

**New ACF Options Page — "Site Stats" (editable from wp-admin):**

| Field | Type | Current Value | Updated By |
|---|---|---|---|
| `total_members` | Number | 1,800,000 | Monthly by marketing |
| `total_languages` | Number | 300 | Quarterly |
| `total_markets` | Number | 222 | Quarterly |
| `total_projects` | Number | 20,000 | Monthly |
| `total_paid_amount` | Text | "$22.5M in 1H25" | Quarterly |
| `total_domain_experts` | Number | 12,000 | Monthly |
| `total_certifications_issued` | Number | TBD | Monthly |

**Shortcode:**
```
[of_stat field="total_members" format="1.8M" prefix="" suffix=" Experts"]
[of_stat field="total_paid_amount"]
```

**Why dynamic:** When stats change (1.8M → 2M members), update once in wp-admin, reflected everywhere. Current approach requires editing every page.

### 3.3 Persona-Adaptive Hero Content

**Concept:** The homepage hero section adapts based on UTM parameters or referring traffic source.

| Traffic Source | Hero Headline | Sub-headline | CTA |
|---|---|---|---|
| Default | "Everyone is an expert in something. We help you prove it." | Three pillar cards | "Put your expertise to work" |
| `?utm_pillar=earn` | "Flexible AI work that pays on time, every time." | Crowd job highlights | "Start earning today" |
| `?utm_pillar=grow` | "Build an AI career, not just a side income." | Certification + skill paths | "Explore growth paths" |
| `?utm_pillar=shape` | "Your [field] PhD is exactly what AI is missing." | Domain expert program | "Shape the future of AI" |
| Google "data annotation jobs" | "Data annotation jobs that respect your expertise." | Featured annotation jobs | "View annotation jobs" |
| Google "ai consulting jobs" | "AI consulting projects for credentialed experts." | Shape program features | "Apply as a domain expert" |

**Implementation:** Elementor + custom JS that reads `utm_pillar` query param or `document.referrer` and shows/hides content sections. Store UTM in `_of_vid` session for return visits.

### 3.4 Dynamic Impact Dashboard (Worker-Facing)

**Concept:** Each job page shows anonymized impact metrics — closing the "transparency gap" (Olivine Priority #3).

**New ACF Fields on `job` CPT:**

| Field | Type | Example |
|---|---|---|
| `workers_active` | Number | 247 |
| `tasks_completed` | Number | 12,450 |
| `avg_rating` | Number (0-5) | 4.7 |
| `impact_metric_label` | Text | "Model accuracy improvement" |
| `impact_metric_value` | Text | "+12% since project start" |

**Display:** Small "Impact" badge section on single job template, rendered via shortcode or Elementor Dynamic Tags.

---

## 4. Programmatic SEO Pages

### 4.1 Shape — Profession Pages (15+ pages)

**Template:** `/shape/for-{profession}`
**Examples:** `/shape/for-physicians`, `/shape/for-nurses`, `/shape/for-attorneys`, `/shape/for-data-scientists`, `/shape/for-linguists`, `/shape/for-psychologists`, `/shape/for-mathematicians`, `/shape/for-pharmacists`, `/shape/for-engineers`, `/shape/for-teachers`, `/shape/for-accountants`, `/shape/for-journalists`, `/shape/for-economists`, `/shape/for-biologists`, `/shape/for-cybersecurity-experts`

**New CPT:** `profession_page` with ACF fields:

| Field | Type | Content |
|---|---|---|
| `profession_name` | Text | "Physicians" |
| `profession_singular` | Text | "Physician" |
| `hero_headline` | Text | "Your medical expertise is exactly what AI needs." |
| `hero_subheadline` | Textarea | "Join 2,400+ healthcare professionals who review AI-generated clinical content..." |
| `why_needed` | WYSIWYG | Why this profession is critical to AI training |
| `project_types` | Repeater | {type_name, description, pay_range, time_commitment} |
| `qualification_criteria` | Repeater | {criterion} |
| `testimonial` | Post Object (worker_story) | Featured worker story |
| `related_jobs` | Relationship (job CPT) | 3-5 live jobs for this profession |
| `seo_keyword` | Text | "ai consulting jobs for physicians" |
| `pay_range_display` | Text | "$25–$65/hr depending on task complexity" |
| `expert_count` | Number | 2,400 |

**Elementor Template:** Single `profession_page` template with Dynamic Tags pulling all fields. One template serves all 15+ pages.

**SEO Targets:**
- "ai consulting jobs for physicians" (1,600/mo)
- "physician side hustles" (880/mo)
- "side hustle for nurses" (1,000/mo)
- "side hustle for lawyers" (260/mo)
- Plus long-tail for each profession

### 4.2 Shape — Specialty Pages (40+ pages)

**Template:** `/shape/specialties/{specialty}`
**Examples:** `/shape/specialties/cardiology`, `/shape/specialties/dermatology`, `/shape/specialties/securities-law`, `/shape/specialties/constitutional-law`, `/shape/specialties/machine-learning`

**Implementation:** Either a separate CPT or a hierarchical taxonomy on `profession_page`.

**Lighter structure:** Each specialty page is a `profession_page` post with a `specialty` taxonomy, using the same Elementor template but with specialty-specific content in ACF fields.

### 4.3 Grow — Translation Pair Pages (20+ pages)

**Template:** `/grow/translation-jobs/{language-pair}`
**Examples:** `/grow/translation-jobs/english-to-french`, `/grow/translation-jobs/english-to-spanish`, `/grow/translation-jobs/english-to-german`, `/grow/translation-jobs/english-to-japanese`

**ACF Fields:**

| Field | Type |
|---|---|
| `source_language` | Text |
| `target_language` | Text |
| `demand_level` | Select (High/Medium/Low) |
| `avg_rate` | Text |
| `related_jobs` | Relationship (job CPT) |
| `certifications_needed` | Repeater |

**SEO Targets:** Translation job queries by language pair (~5K/mo across all pairs).

### 4.4 For Business — Comparison Pages (6 pages)

**Template:** `/for-business/compare/oneforma-vs-{competitor}`
**Competitors:** Mercor, Outlier (Scale AI), Surge AI, Handshake, Appen, Prolific

**ACF Fields:**

| Field | Type |
|---|---|
| `competitor_name` | Text |
| `competitor_logo` | Image |
| `comparison_table` | Repeater {feature, oneforma_value, competitor_value, winner} |
| `oneforma_strengths` | Repeater {strength, description} |
| `competitor_strengths` | Repeater {strength, description} |
| `verdict` | WYSIWYG |
| `seo_keyword` | Text |

**Tone:** Honest. Show where OneForma wins AND where competitors win. Olivine's directive: "position as the honest platform."

### 4.5 Trust — "Is [Platform] Legit?" Pages

**Template:** `/is-{platform}-legit`
**Pages:** `/is-oneforma-legit` (exists), `/is-mercor-legit` (NEW — 4,400/mo), `/is-outlier-legit`, `/is-surge-ai-legit`, `/is-appen-legit`

**Strategy:** Own the category legitimacy conversation. Each page provides honest, balanced assessment of the platform with a comparative table. Positions OneForma as the transparent, trustworthy voice.

---

## 5. New Integrations

### 5.1 Trustpilot Widget Integration (P0 — CRITICAL)

**Current state:** 1.4/5 on Trustpilot (worst in category). Brand promise is "respect" but public reviews contradict.

**Integration:**

| Component | Implementation |
|---|---|
| **Trustpilot Review Widget** | Embed on homepage, `/earn`, `/grow`, `/shape` |
| **TrustBox Widget** | Elementor HTML widget with Trustpilot embed code |
| **Review Invitation API** | Trigger after first payment via centric-intake pipeline or Teams webhook |
| **Smart Widget** | Show only recent positive reviews (Trustpilot allows filtering) until score improves |

**Why P0:** You cannot promise "the platform that respects experts" while showing 1.4/5 on Trustpilot. Remediation outreach (targeting +9.5 NPS Crowd/Pro tier users) must happen concurrently.

### 5.2 Community Platform (Olivine Priority #4)

**Recommended:** Discord (free, global, async-friendly, 222-market user base)

| Feature | Implementation |
|---|---|
| **Discord Server** | Channels: #earn-general, #grow-certifications, #shape-experts, #project-{name}, #payments-help, #announcements |
| **Discord Widget** | Embed member count + join link on homepage and pillar hubs |
| **Discord Bot** | Auto-post new jobs from pipeline (when `wp_job_publisher.py` creates a job, also POST to Discord webhook) |
| **Verification** | Link Discord account to my.oneforma.com profile for verified roles |

**Implementation in pipeline:**
```python
# In wp_job_publisher.py, after successful WP publish:
async def notify_discord(title, url, job_type, pillar):
    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
    payload = {
        "embeds": [{
            "title": f"New {job_type} Opportunity: {title}",
            "url": url,
            "color": 0x0693E3,
            "fields": [
                {"name": "Pillar", "value": pillar, "inline": True},
                {"name": "Type", "value": job_type, "inline": True},
            ]
        }]
    }
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json=payload)
```

### 5.3 Intercom / Crisp Live Chat

**Current state:** Help center + contact form. Users say support is "unresponsive" (357 mentions in Olivine survey).

**Recommended:** Intercom or Crisp (live chat + knowledge base + bot).

| Feature | Purpose |
|---|---|
| **Live chat widget** | Instant support on all pages |
| **Bot auto-responses** | Answer common questions from help center KB |
| **Pillar routing** | SHAPE experts → priority queue (address NPS +4.2 for Master's holders) |
| **Proactive messages** | "Need help with your application?" on job pages |
| **Help center integration** | Replace custom FAQ CPT with Intercom Articles (or keep WP and sync) |

**Elementor integration:** Add Intercom/Crisp script via Custom Code in Site Settings `<head>`.

### 5.4 AidaForm / Typeform Integration (Application Forms)

**Current state:** Job applications go to `my.oneforma.com/crowd/jobs/{id}`. Some projects use AidaForm.

**Enhancement:** Track form completions back to WordPress for conversion analytics.

**Implementation:**
- Pass UTM parameters from WordPress job page → apply URL via ACF `apply_url` field
- Add hidden fields to AidaForm: `utm_source`, `utm_medium`, `utm_campaign`, `job_slug`
- Fire GA4 event on click: `apply_button_click` with job_id, pillar, job_type

### 5.5 Payoneer/PayPal Status API (Transparency)

**Concept:** Show payment reliability stats on the site — "Paid $22.5M in 1H25" is a start, but make it dynamic.

**Implementation (lightweight):**
- ACF Options Page field: `payments_stat_display` (text, manually updated quarterly)
- Shortcode: `[of_stat field="total_paid_amount"]`
- Rendered on homepage, `/earn` hub, help center payment section

**Future (API-driven):**
- If Payoneer/Tipalti provides aggregate API, pull total disbursed and display in real-time

### 5.6 Schema.org JobPosting Structured Data

**Current state:** No JobPosting schema on job pages. Yoast handles Organization/WebSite schema only.

**Recommended:** Add JobPosting schema to every `/jobs/{slug}/` page for Google Jobs rich results.

**Implementation in `oneforma-helpers.php`:**

```php
add_action('wp_head', function() {
    if (!is_singular('job')) return;
    
    $post_id = get_the_ID();
    $title = get_the_title();
    $content = wp_strip_all_tags(get_the_content());
    $excerpt = get_the_excerpt() ?: substr($content, 0, 200);
    $url = get_permalink();
    $date = get_the_date('c');
    $modified = get_the_modified_date('c');
    
    $tags = get_the_terms($post_id, 'job_tag');
    $types = get_the_terms($post_id, 'job_type');
    
    // Determine location
    $location = 'TELECOMMUTE';
    $location_names = [];
    if ($tags) {
        foreach ($tags as $tag) {
            if (!in_array($tag->name, ['Fixed Rate Per Hour', 'Fixed Rate Per Approved Asset', 
                'Fixed Rate Upon Completion', 'Fixed Rate Per Source Word'])) {
                $location_names[] = $tag->name;
            }
        }
    }
    
    $schema = [
        '@context' => 'https://schema.org',
        '@type' => 'JobPosting',
        'title' => $title,
        'description' => $excerpt,
        'datePosted' => $date,
        'validThrough' => date('c', strtotime('+90 days')),
        'url' => $url,
        'hiringOrganization' => [
            '@type' => 'Organization',
            'name' => 'OneForma',
            'sameAs' => 'https://www.oneforma.com',
            'logo' => 'https://www.oneforma.com/wp-content/uploads/2025/03/oneforma-logo.svg',
        ],
        'jobLocationType' => 'TELECOMMUTE',
        'applicantLocationRequirements' => $location_names 
            ? array_map(fn($l) => ['@type' => 'Country', 'name' => $l], $location_names)
            : [['@type' => 'Country', 'name' => 'Worldwide']],
        'employmentType' => 'CONTRACTOR',
        'industry' => 'Artificial Intelligence',
    ];
    
    if ($types) {
        $schema['occupationalCategory'] = $types[0]->name;
    }
    
    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_SLASHES) . '</script>';
});
```

**Impact:** Jobs appear in Google Jobs search results — massive visibility boost for "data annotation jobs" and related queries.

### 5.7 Mailchimp / Brevo Email Integration

**Current state:** No visible email marketing.

**Recommended:** Collect emails segmented by pillar for nurture sequences.

| Touchpoint | Trigger | Segment |
|---|---|---|
| `/earn` hub CTA | "Get notified about new crowd jobs" | Earn subscribers |
| `/grow` hub CTA | "Get certified — start your AI career" | Grow subscribers |
| `/shape` hub CTA | "Domain expert opportunities in your field" | Shape subscribers |
| Blog subscribe | End-of-post widget | General |
| Job alert signup | Job archive page | By job_type preference |

**Elementor integration:** Elementor Pro Forms → Mailchimp/Brevo action. Tag subscribers with pillar on submission.

### 5.8 Reddit Presence (Olivine Flagged)

**Current state:** Unclaimed channel. Workers discuss OneForma on r/beermoney, r/WorkOnline, r/uhrswork.

**Recommendation:**
- Claim r/OneForma subreddit (or create if unclaimed)
- Monitor mentions via Google Alerts or Mention.com
- Add Reddit icon to social links in footer
- Post Worker Stories to relevant subreddits

---

## 6. New Site Functionality

### 6.1 Skill Path Visualizer (GROW Pillar)

**Concept:** Interactive visualization showing progression from Entry → Intermediate → Expert across different skill tracks.

**Tracks:**
- Data Annotation → Quality Assurance → Annotation Lead
- Transcription → Translation → MTPE Specialist
- AI Evaluation → Prompt Engineering → AI Tutor
- Red Teaming → Safety Auditing → Adversarial Engineer

**Implementation:** Elementor + custom HTML/CSS or a lightweight React component embedded via shortcode. Each node links to relevant jobs and certifications.

### 6.2 Project Match Quiz (All Pillars)

**Concept:** 5-question quiz that recommends the right pillar and project type.

**Questions:**
1. What's your highest education level? (Entry/Bachelor's/Master's/PhD)
2. How many hours per week can you commit? (1-5/5-15/15-30/30+)
3. What motivates you most? (Income/Career growth/Intellectual contribution)
4. Do you have domain expertise? (No/Some/Deep specialization)
5. Which best describes your AI experience? (None/Beginner/Intermediate/Advanced)

**Result:** Routes to Earn, Grow, or Shape hub with personalized job recommendations.

**Implementation:** Elementor Pro Form (multi-step) with conditional logic → redirect to pillar hub with URL params → dynamic content shows matched jobs.

### 6.3 Worker Stories Hub (/stories)

**New CPT: `worker_story`**

**ACF Fields:**

| Field | Type | Purpose |
|---|---|---|
| `worker_name` | Text | First name + last initial |
| `worker_country` | Text | Country of residence |
| `worker_profession` | Text | Professional background |
| `worker_photo` | Image | Portrait photo |
| `pillar` | Select (Earn/Grow/Shape) | Which pillar they represent |
| `quote` | Textarea | Pull-quote for cards |
| `projects_completed` | Number | Social proof |
| `tenure_months` | Number | How long with OneForma |
| `impact_highlight` | Text | e.g., "Improved medical AI accuracy by 12%" |
| `video_url` | URL | Optional YouTube/Vimeo embed |

**Display:** Grid archive at `/stories`, filterable by pillar. Featured on homepage carousel and pillar hub pages.

**Why this matters:** Olivine Priority #3 (transparency gap) + addresses "66% unaware of brand" finding. Real faces from 222 markets prove the "radically inclusive" positioning.

### 6.4 Earnings Calculator (EARN Pillar)

**Concept:** Interactive tool: "How much could you earn with OneForma?"

**Inputs:**
- Hours per week (slider: 1–40)
- Skill level (Entry/Intermediate/Expert)
- Project type (Annotation/Transcription/Translation/etc.)

**Output:**
- Estimated weekly/monthly earnings range
- Example projects at that level
- CTA: "Put your expertise to work →"

**Implementation:** Custom shortcode or Elementor HTML widget with vanilla JS. Uses pay range data from ACF fields on job posts.

### 6.5 Certification Badges (GROW Pillar)

**Concept:** Shareable digital badges for completed certifications. Workers embed on LinkedIn/resume.

**Implementation:**
- Generate badge images via the pipeline (Seedream or template-based)
- Store in Vercel Blob
- Provide shareable URL and LinkedIn "Add to Profile" button
- Display earned badges on worker profile (requires my.oneforma.com integration)

### 6.6 Smart Job Alerts

**Concept:** Workers subscribe to job alerts filtered by:
- Pillar (Earn/Grow/Shape)
- Job type (Annotation/Transcription/etc.)
- Language
- Region

**Implementation:**
- ACF form or Elementor Form on `/jobs` page
- Store preferences in a new `job_alert_subscriptions` table (Neon DB)
- When `wp_job_publisher.py` creates a new job, check subscribers that match and send email via Brevo/Mailchimp API
- Add Discord notification for matching subscribers

### 6.7 Multi-Language Support (Geographic Reality)

**Current state:** English only. But 93% of users are outside North America (EU 33%, E/SE Asia 24%, S.Asia 13%).

**Phase 1 (Content localization):**
- Add `hreflang` tags for key pages
- Translate pillar hub pages into top 5 languages: Spanish, Portuguese, French, German, Hindi
- Use Elementor's multi-language compatibility with WPML or TranslatePress

**Phase 2 (Dynamic language detection):**
- Browser language detection → show localized content or language switcher
- Programmatic translation pair pages serve as natural entry points for non-English speakers

---

## 7. Pipeline Enhancements (centric-intake)

### 7.1 Auto-Assign Pillar on Job Publish

**Enhancement to `wp_job_publisher.py`:**

Add pillar assignment logic based on task_type and difficulty:

```python
TASK_TYPE_TO_PILLAR = {
    "annotation": "earn",      # Default to earn for crowd annotation
    "data_collection": "earn",
    "transcription": "earn",
    "translation": "grow",     # Translation = skill-building
    "judging": "grow",
    "llm_prompt_authoring": "shape",  # Prompt authoring = expert level
}

# Override based on form_data
if form_data.get("requires_phd") or form_data.get("domain_expert"):
    pillar = "shape"
elif form_data.get("requires_certification"):
    pillar = "grow"
```

Set as taxonomy term when creating the job post.

### 7.2 Auto-Generate Impact Statements

**Enhancement to Stage 1 (Intelligence):**

After job creation, generate an impact statement via LLM:

```python
impact_prompt = f"""Given this job: {title} ({task_type})
Generate a one-sentence impact statement that describes how this work improves AI.
Frame it as worker impact, not client benefit.
Example: "Your annotations will help voice assistants understand 30M+ users more naturally."
"""
```

Store in ACF field `impact_statement` on the job post.

### 7.3 Discord + Slack Notification on Job Publish

Add to `wp_job_publisher.py` after successful WordPress publish:

```python
# Notify Discord channel
if os.environ.get("DISCORD_WEBHOOK_URL"):
    await notify_discord(title, wp_url, job_type, pillar)

# Existing Teams notification continues
if TEAMS_WEBHOOK_URL:
    await notify_teams(title, wp_url, request_id)
```

### 7.4 JobPosting Schema Auto-Injection

Instead of relying on the PHP shortcode, have the pipeline set a `meta` field with pre-built schema JSON:

```python
schema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": title,
    "description": seo_excerpt,
    "datePosted": datetime.utcnow().isoformat(),
    "validThrough": (datetime.utcnow() + timedelta(days=90)).isoformat(),
    "hiringOrganization": {"@type": "Organization", "name": "OneForma"},
    "jobLocationType": "TELECOMMUTE",
    "employmentType": "CONTRACTOR",
}
# Set as meta field
payload["meta"] = {"job_schema_json": json.dumps(schema)}
```

The `oneforma-helpers.php` mu-plugin then reads and outputs this field in `wp_head`.

---

## 8. Content & Community Features

### 8.1 Blog Content Calendar (Aligned to Pillars)

| Pillar | Content Type | Target Keyword | Frequency |
|---|---|---|---|
| EARN | "Getting Started" guides | "data annotation jobs" | 2x/month |
| EARN | "Day in the Life" worker profiles | "ai training work from home" | 1x/month |
| GROW | Certification prep content | "ai certification" | 2x/month |
| GROW | Skill development articles | "ai for beginners" | 1x/month |
| SHAPE | Expert interviews | "ai consulting" | 2x/month |
| SHAPE | Industry impact reports | "[profession] + AI" | 1x/month |
| TRUST | "Is [Platform] Legit?" series | "is mercor legit" | 1x/quarter per platform |
| ALL | "AI Jobs Landscape" annual report | "ai jobs 2026" | Annual |

### 8.2 Worker Bill of Rights (Brand Asset)

**Concept:** Publishable commitment page at `/worker-bill-of-rights` that operationalizes "respected, not treated like a resource."

**Content:**
1. You will always know why your account status changed
2. You will receive payment on the stated schedule
3. You will get a response to support requests within 48 hours
4. You will see the impact of your work
5. You will never be required to pay to access opportunities
6. Your data is your property
7. Your expertise will be recognized, not commoditized

**Why:** Directly addresses top 3 detractor themes from Olivine survey (payment inconsistency, unexplained suspensions, unresponsive support). Makes the brand promise concrete and auditable.

### 8.3 Monthly Impact Report (Email + Web)

**Concept:** Monthly email to all active workers showing:
- Projects you contributed to
- Aggregate impact metrics
- New opportunities matched to your profile
- Community highlights

**Web version:** Published at `/impact/2026-{month}` as a public page (builds trust for new visitors).

---

## 9. Analytics & Measurement

### 9.1 New GA4 Events to Track

| Event | Trigger | Parameters |
|---|---|---|
| `pillar_view` | Pillar hub page viewed | `pillar_name` (earn/grow/shape) |
| `job_view` | Single job page viewed | `job_id`, `job_type`, `pillar`, `difficulty_level` |
| `apply_click` | Apply button clicked | `job_id`, `language`, `pillar`, `apply_url` |
| `quiz_start` | Project Match Quiz started | — |
| `quiz_complete` | Quiz completed | `recommended_pillar`, `quiz_answers` |
| `story_view` | Worker Story viewed | `story_id`, `pillar`, `profession` |
| `calculator_use` | Earnings Calculator used | `hours_selected`, `skill_level`, `project_type` |
| `email_subscribe` | Email signup | `pillar`, `form_location` |
| `discord_click` | Discord join link clicked | `page`, `pillar` |
| `comparison_view` | Comparison page viewed | `competitor` |
| `certification_interest` | Certification CTA clicked | `certification_type` |
| `share_click` | Social share button clicked | `platform`, `job_id` |

### 9.2 New GA4 Audiences

| Audience | Definition | Activation |
|---|---|---|
| Earn Intenders | Viewed `/earn` + viewed 2+ earn-pillar jobs | Retargeting, email |
| Grow Intenders | Viewed `/grow` + clicked certification CTA | Retargeting, email |
| Shape Intenders | Viewed `/shape` + viewed profession page | Retargeting, email |
| High-Intent Applicants | Clicked apply button on any job | Retargeting |
| Comparison Shoppers | Viewed 2+ comparison pages | Retargeting with differentiation messaging |
| Quiz Completers | Completed Project Match Quiz | Personalized retargeting by recommended pillar |

### 9.3 Conversion Funnels to Build

```
EARN Funnel:
  Landing (Google "data annotation jobs")
  → /earn hub
  → Job view (annotation job)
  → Apply click
  → Registration (my.oneforma.com)

SHAPE Funnel:
  Landing (Google "ai consulting jobs for physicians")
  → /shape/for-physicians
  → Shape hub
  → Job view (expert job)
  → Apply click
  → Registration

TRUST Funnel:
  Landing (Google "is oneforma legit")
  → /is-oneforma-legit
  → Homepage or pillar hub
  → Job view
  → Apply click
```

---

## 10. Priority Matrix

### P0 — Do Before/During Elementor Migration (Week 0–2)

| # | Item | Effort | Impact | Blocks |
|---|---|---|---|---|
| 1 | Add `pillar` taxonomy to `job` CPT | 30 min | High | All pillar filtering |
| 2 | Add JobPosting schema to job pages | 2 hr | Very High | Google Jobs visibility |
| 3 | Collapse 3 help center trees → single `/help` | 2 hr | Medium | SEO cleanup |
| 4 | Collapse 4 contact pages → single `/contact` | 1 hr | Medium | SEO cleanup |
| 5 | Fix Help Center meta description leak | 5 min | Low | SEO hygiene |
| 6 | Register `worker_story` CPT | 1 hr | Medium | Stories feature |
| 7 | Add `oneforma-helpers.php` mu-plugin | 1 hr | High | All shortcodes |
| 8 | Trustpilot remediation outreach (email NPS +9.5 users) | 4 hr | Critical | Brand credibility |

### P1 — Launch With New Site (Week 2–4)

| # | Item | Effort | Impact |
|---|---|---|---|
| 9 | Build `/earn`, `/grow`, `/shape` hub pages | 6 hr | Very High |
| 10 | New homepage with pillar pathways | 4 hr | Very High |
| 11 | New header navigation (Earn/Grow/Shape/For Business/Help) | 1 hr | High |
| 12 | Dynamic stats (ACF Options Page) | 2 hr | Medium |
| 13 | Worker Stories — seed 5 initial stories | 8 hr | High |
| 14 | Discord server setup + embed widget | 3 hr | High |
| 15 | Email signup forms on pillar hubs (Brevo/Mailchimp) | 2 hr | Medium |
| 16 | Update robots.txt — unblock AI bots per AEO mandate | 15 min | High |

### P2 — Growth Phase (Week 4–12)

| # | Item | Effort | Impact |
|---|---|---|---|
| 17 | 3 EARN anchor pages (data annotation jobs, ai training jobs, ai trainer jobs) | 12 hr | Very High |
| 18 | 7 SHAPE profession pages (physicians, nurses, attorneys, data scientists, linguists, psychologists, mathematicians) | 14 hr | Very High |
| 19 | 6 comparison pages (vs Mercor, Outlier, Surge, Handshake, Appen, Prolific) | 12 hr | High |
| 20 | Earnings Calculator | 6 hr | Medium |
| 21 | Project Match Quiz | 8 hr | Medium |
| 22 | Intercom/Crisp live chat | 4 hr | High |
| 23 | Pipeline: auto-assign pillar, auto-impact-statements, Discord notify | 4 hr | Medium |
| 24 | Blog content calendar — publish first 6 articles | 24 hr | High |

### P3 — Scale Phase (Week 12–24)

| # | Item | Effort | Impact |
|---|---|---|---|
| 25 | 40+ specialty pages under `/shape/specialties/` | 20 hr | High |
| 26 | 20+ translation pair pages under `/grow/translation-jobs/` | 10 hr | Medium |
| 27 | "Is [platform] legit?" content series (5 pages) | 10 hr | Medium |
| 28 | Skill Path Visualizer (interactive) | 12 hr | Medium |
| 29 | Certification badges (shareable) | 8 hr | Medium |
| 30 | Smart Job Alerts (email notifications on new matching jobs) | 12 hr | High |
| 31 | Multi-language support (top 5 languages) | 40 hr | Very High |
| 32 | Worker Bill of Rights page | 4 hr | Medium |
| 33 | Monthly Impact Report (web + email) | 8 hr | Medium |

---

## 11. Technical Implementation Notes

### 11.1 New CPT Registrations

Add to `oneforma-helpers.php` mu-plugin:

```php
add_action('init', function() {
    // Worker Stories CPT
    register_post_type('worker_story', [
        'labels' => ['name' => 'Worker Stories', 'singular_name' => 'Worker Story'],
        'public' => true,
        'has_archive' => true,
        'rewrite' => ['slug' => 'stories'],
        'supports' => ['title', 'editor', 'thumbnail', 'excerpt'],
        'show_in_rest' => true,
        'menu_icon' => 'dashicons-groups',
    ]);
    
    // Profession Pages CPT
    register_post_type('profession_page', [
        'labels' => ['name' => 'Profession Pages', 'singular_name' => 'Profession Page'],
        'public' => true,
        'has_archive' => false,
        'rewrite' => ['slug' => 'shape/for', 'with_front' => false],
        'supports' => ['title', 'editor', 'thumbnail'],
        'show_in_rest' => true,
        'menu_icon' => 'dashicons-businessman',
    ]);
    
    // Pillar taxonomy on jobs
    register_taxonomy('pillar', 'job', [
        'labels' => ['name' => 'Pillars', 'singular_name' => 'Pillar'],
        'hierarchical' => false,
        'show_in_rest' => true,
        'rewrite' => ['slug' => 'pillar'],
    ]);
    
    // Profession taxonomy on jobs
    register_taxonomy('profession', 'job', [
        'labels' => ['name' => 'Professions', 'singular_name' => 'Profession'],
        'hierarchical' => true,
        'show_in_rest' => true,
        'rewrite' => ['slug' => 'profession'],
    ]);
    
    // Specialty taxonomy
    register_taxonomy('specialty', ['job', 'profession_page'], [
        'labels' => ['name' => 'Specialties', 'singular_name' => 'Specialty'],
        'hierarchical' => true,
        'show_in_rest' => true,
        'rewrite' => ['slug' => 'specialty'],
    ]);
});
```

### 11.2 Elementor Theme Builder Templates Needed

| # | Template | Type | Condition | Serves |
|---|---|---|---|---|
| 1 | Single Worker Story | Single | Post Type = `worker_story` | `/stories/{slug}` |
| 2 | Worker Stories Archive | Archive | Post Type Archive = `worker_story` | `/stories` |
| 3 | Single Profession Page | Single | Post Type = `profession_page` | `/shape/for-{profession}` |
| 4 | Single Job (updated) | Single | Post Type = `job` | Add pillar badge, impact statement, enhanced ACF |
| 5 | Job Archive (updated) | Archive | Post Type Archive = `job` | Add pillar filter tabs |

### 11.3 Pipeline Changes Summary

| File | Change | Risk |
|---|---|---|
| `wp_job_publisher.py` | Add `pillar` taxonomy assignment | Low |
| `wp_job_publisher.py` | Add Discord webhook notification | Low |
| `wp_job_publisher.py` | Add `impact_statement` ACF field write | Low |
| `wp_rest_client.py` | Add `pillar` to taxonomy setter | Low |
| `config.py` | Add `DISCORD_WEBHOOK_URL` env var | None |
| `neon_client.py` | No changes | None |

All pipeline changes are additive and non-breaking. Existing functionality is untouched.

---

*Document created April 28, 2026. Recommendations aligned to Olivine rebrand framework, current technical capabilities, and Elementor Pro migration plan.*
