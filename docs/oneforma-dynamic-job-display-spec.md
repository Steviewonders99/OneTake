# OneForma.com — Dynamic Job Display, Search & Interactive Components Spec

> **Created:** April 28, 2026
> **Author:** Steven Junop (Digital Marketing Manager, Centific / OneForma)
> **Stack:** WordPress 6.9.4 + Elementor Pro + ACF Pro + Hello Elementor
> **Companion:** `oneforma-elementor-migration-spec.md`, `oneforma-new-functionality-recommendations.md`
> **Classification:** Internal — Confidential

---

## Table of Contents

1. [Overview](#1-overview)
2. [ACF Fields Required](#2-acf-fields-required)
3. [Dynamic Job Sliders & Carousels](#3-dynamic-job-sliders--carousels)
4. [Advanced Job Search](#4-advanced-job-search)
5. [Faceted Filtering System](#5-faceted-filtering-system)
6. [AJAX Live Job Browser](#6-ajax-live-job-browser)
7. [Smart Recommendation Engine](#7-smart-recommendation-engine)
8. [Job Cards Design System](#8-job-cards-design-system)
9. [Interactive Job Map](#9-interactive-job-map)
10. [Job Comparison Tool](#10-job-comparison-tool)
11. [Micro-Interactions & UX Polish](#11-micro-interactions--ux-polish)
12. [Implementation Approach](#12-implementation-approach)
13. [REST API Endpoints](#13-rest-api-endpoints)
14. [Complete Code: oneforma-jobs.php](#14-complete-code-oneforma-jobsphp)
15. [Performance Considerations](#15-performance-considerations)

---

## 1. Overview

### Current State (oneforma2025 theme)

| Component | Implementation | Limitations |
|---|---|---|
| Homepage carousel | Slick.js, 3 featured jobs, manual pagination dots | Static, no filtering, no pillar awareness |
| Job archive | Custom PHP grid, 9 per page, basic category tabs | Full page reload on filter, no search, no AJAX |
| Sorting | Newest/Oldest/A-Z/Z-A dropdown | Reloads entire page |
| Search | None on job pages | Users must use WordPress global search |
| Filtering | Category tabs only (job_type) | No multi-filter, no location, no compensation, no pillar |

### Target State

| Component | Implementation | Capabilities |
|---|---|---|
| Pillar sliders | Custom shortcodes + Swiper.js | Auto-populated per pillar, filterable, responsive |
| Featured jobs carousel | Elementor Loop + custom query | Editorially curated OR dynamic "trending" |
| Job search | AJAX-powered instant search | Real-time results as you type, searches title + content + tags |
| Faceted filters | Multi-select sidebar/bar | Pillar, job type, location, compensation, difficulty, language |
| AJAX browsing | REST API + vanilla JS | No page reloads, URL updates via History API, infinite scroll OR pagination |
| Recommendations | Cookie/session-based | "Based on your interests" + "Similar jobs" on single job pages |
| Job map | Lightweight SVG map | Visual location-based job browsing |
| Comparison | Side-by-side tool | Compare 2-3 jobs on key dimensions |

---

## 2. ACF Fields Required

### 2.1 New Fields on `job` CPT

These fields enable all dynamic display features. Add to the existing ACF field group:

| Field Name | Type | Options | Purpose |
|---|---|---|---|
| `pillar` | Select | Earn, Grow, Shape | Primary pillar assignment |
| `difficulty_level` | Select | Entry, Intermediate, Expert | Skill level indicator |
| `pay_range_min` | Number | — | Minimum $/hr or per-task |
| `pay_range_max` | Number | — | Maximum $/hr or per-task |
| `time_commitment` | Select | Flexible (1-5 hrs/wk), Part-time (5-20 hrs/wk), Full-time (20+ hrs/wk), One-time | Weekly hours expected |
| `project_status` | Select | Actively Hiring, Waitlist, Starting Soon, Completed | Real-time project status |
| `is_featured` | True/False | — | Editorially featured for carousels |
| `is_urgent` | True/False | — | Urgently hiring flag |
| `languages_needed` | Textarea | — | Comma-separated language list |
| `spots_remaining` | Number | — | Available slots (for scarcity display) |
| `workers_active` | Number | — | Current active workers |
| `card_highlight` | Text | — | One-line highlight for card display (e.g., "$65/hr", "Remote", "PhD Required") |

### 2.2 Taxonomy Additions

| Taxonomy | On CPT | Terms | Purpose |
|---|---|---|---|
| `pillar` | `job` | Earn, Grow, Shape | Pillar filtering |
| `profession` | `job` | Physicians, Nurses, Attorneys, etc. | Profession filtering |
| `location_region` | `job` | Worldwide, US, EU, Asia, etc. | Location filtering (cleaner than overloading `job_tag`) |

---

## 3. Dynamic Job Sliders & Carousels

### 3.1 Pillar Spotlight Sliders

Three independent carousels, one per pillar. Used on homepage and pillar hub pages.

**Shortcode:**
```
[job_slider pillar="earn" count="8" autoplay="true" speed="4000"]
[job_slider pillar="grow" count="6" autoplay="false"]
[job_slider pillar="shape" count="4" columns="2" style="featured"]
```

**Parameters:**

| Param | Default | Options | Description |
|---|---|---|---|
| `pillar` | `all` | `earn`, `grow`, `shape`, `all` | Filter by pillar |
| `count` | `6` | 1–20 | Max jobs to show |
| `columns` | `3` | 1–4 | Visible cards at once (desktop) |
| `autoplay` | `true` | `true`, `false` | Auto-advance slides |
| `speed` | `5000` | ms | Autoplay interval |
| `style` | `card` | `card`, `featured`, `minimal`, `hero` | Card style variant |
| `job_type` | — | Taxonomy slug | Filter by job_type |
| `difficulty` | — | `entry`, `intermediate`, `expert` | Filter by difficulty |
| `status` | `publish` | Post status | Only published jobs |
| `orderby` | `date` | `date`, `rand`, `title`, `meta_value` | Sort order |
| `featured_only` | `false` | `true`, `false` | Only show `is_featured=true` jobs |

**Responsive Behavior:**

| Breakpoint | Columns | Card Style |
|---|---|---|
| Desktop (1200px+) | 3 (or as specified) | Full card with image area |
| Tablet (768px–1199px) | 2 | Compact card |
| Mobile (< 768px) | 1 | Full-width card, swipeable |

**Slider Library:** Swiper.js (MIT, 45KB gzipped, touch-friendly, accessibility support, better than Slick.js which is unmaintained).

### 3.2 Featured Jobs Carousel (Homepage Hero)

The main carousel below the hero section. Shows editorially curated OR algorithmically selected jobs.

**Shortcode:**
```
[featured_jobs_carousel count="6" show_navigation="true" show_pagination="dots"]
```

**Logic:**
1. First: show jobs where `is_featured = true` (editorial picks)
2. Fill remaining slots with: `is_urgent = true` jobs
3. Fill remaining with: most recently published jobs
4. Randomize final order for variety on repeat visits

**Card layout (featured style):**
```
┌─────────────────────────────────────────┐
│  [Pillar Badge: EARN]  [Urgent Badge]   │
│                                          │
│  Job Title (H3, max 2 lines)            │
│                                          │
│  📍 Worldwide  ·  💰 $15-25/hr          │
│  🕐 Flexible   ·  📊 Entry Level        │
│                                          │
│  "Help improve Voice Assistant tech..." │
│  (excerpt, max 2 lines)                  │
│                                          │
│  [Learn More →]        [12 spots left]  │
└─────────────────────────────────────────┘
```

### 3.3 "Trending Now" Auto-Slider

Shows the most-viewed or most-applied-to jobs in the last 7 days.

**Data source:** GA4 `job_view` events aggregated weekly OR simple view counter in `wp_postmeta`.

**Shortcode:**
```
[trending_jobs count="5" period="7days"]
```

**Implementation (lightweight view counter):**
```php
// Track views on single job pages
add_action('template_redirect', function() {
    if (!is_singular('job') || is_admin()) return;
    $post_id = get_the_ID();
    $views = (int) get_post_meta($post_id, '_job_views_7d', true);
    update_post_meta($post_id, '_job_views_7d', $views + 1);
    update_post_meta($post_id, '_job_last_viewed', current_time('mysql'));
});

// Weekly cron to reset 7-day counters
add_action('of_reset_job_views', function() {
    global $wpdb;
    $wpdb->query("UPDATE {$wpdb->postmeta} SET meta_value = 0 WHERE meta_key = '_job_views_7d'");
});
if (!wp_next_scheduled('of_reset_job_views')) {
    wp_schedule_event(time(), 'weekly', 'of_reset_job_views');
}
```

### 3.4 "New This Week" Badge Slider

Horizontally scrollable strip showing jobs published in the last 7 days.

**Shortcode:**
```
[new_jobs_strip days="7" style="pill"]
```

**Display:** Horizontal scrollable row of pill-shaped badges:
```
← [🆕 Jellyfish Annotation] [🆕 Mosaic Recording] [🆕 Dola Search Eval] [🆕 Centaurus Video] →
```

Each pill links to the job. Swipeable on mobile.

### 3.5 Pillar Hub Page Sliders

Each pillar hub (`/earn`, `/grow`, `/shape`) gets a customized slider:

**EARN Hub (`/earn`):**
```
[job_slider pillar="earn" count="9" columns="3" style="card"]
[section_heading text="Popular in Your Region" size="h3"]
[job_slider pillar="earn" count="6" columns="3" orderby="rand" location="auto"]
```

**GROW Hub (`/grow`):**
```
[job_slider pillar="grow" count="6" columns="2" style="featured" job_type="translation"]
[section_heading text="Build Your Skills" size="h3"]
[job_slider pillar="grow" count="6" columns="3" difficulty="intermediate"]
```

**SHAPE Hub (`/shape`):**
```
[job_slider pillar="shape" count="4" columns="2" style="hero" difficulty="expert"]
[section_heading text="Your Expertise, Their AI" size="h3"]
[job_slider pillar="shape" count="6" columns="3" featured_only="true"]
```

---

## 4. Advanced Job Search

### 4.1 Instant Search Bar

AJAX-powered search that returns results as the user types (debounced 300ms).

**Shortcode:**
```
[job_search placeholder="Search jobs by title, skill, or language..." show_filters="true"]
```

**UI:**
```
┌──────────────────────────────────────────────────────┐
│  🔍  Search jobs by title, skill, or language...     │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  ┌─ Quick Filters ────────────────────────────────┐  │
│  │ [Earn] [Grow] [Shape] │ [All Types ▾] │ [All ▾]│  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Results (updating live) ──────────────────────┐  │
│  │  Jellyfish – Voice Assistant Annotation        │  │
│  │  📍 Worldwide · 💰 Per Hour · EARN             │  │
│  │  ────────────────────────────────────────────  │  │
│  │  Dola — Multilingual Web Search Annotation     │  │
│  │  📍 Bahrain, Oman · 💰 $10/hr · EARN          │  │
│  │  ────────────────────────────────────────────  │  │
│  │  Board Certified Clinical Notes Specialist     │  │
│  │  📍 US · 💰 $45-65/hr · SHAPE                 │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Showing 3 of 46 jobs  ·  [View All Results →]      │
└──────────────────────────────────────────────────────┘
```

**Search targets:** Post title, post content, excerpt, ACF `languages_needed`, `card_highlight`, taxonomy terms (job_type, job_tag, pillar, profession).

**Keyboard navigation:** Arrow keys to navigate results, Enter to open, Escape to close.

### 4.2 Search Suggestions / Autocomplete

As the user types, show categorized suggestions:

```
Type: "trans"
─────────────────────────────────
📁 Categories
   Translation (12 jobs)
   Transcription (4 jobs)

💼 Jobs
   Vega Transcription
   BGN Transcription
   HT Human Translation and MTPE
   Acceptability and Preference Translation Raters

🏷️ Skills
   Translating · Transcript Review · Medical Transcription
```

**Implementation:** Custom REST endpoint that returns grouped suggestions.

### 4.3 Search Results Page

When user presses Enter or clicks "View All Results," full search results page with faceted filters.

**URL pattern:** `/jobs/?s={query}&pillar=earn&type=annotation&location=worldwide`

The search state is encoded in the URL so results are bookmarkable and shareable.

---

## 5. Faceted Filtering System

### 5.1 Filter Dimensions

| Filter | Type | Source | UI Element |
|---|---|---|---|
| **Pillar** | Multi-select | `pillar` taxonomy | Toggle buttons (Earn/Grow/Shape) |
| **Job Type** | Multi-select | `job_type` taxonomy | Checkbox list or dropdown |
| **Location** | Multi-select | `job_tag` (location tags) or new `location_region` taxonomy | Checkbox list |
| **Compensation** | Multi-select | `job_tag` (compensation tags) | Checkbox list |
| **Difficulty** | Single-select | ACF `difficulty_level` | Radio buttons or segmented control |
| **Time Commitment** | Multi-select | ACF `time_commitment` | Checkbox list |
| **Status** | Single-select | ACF `project_status` | Dropdown |
| **Language** | Text/autocomplete | ACF `languages_needed` | Autocomplete input |
| **Pay Range** | Range slider | ACF `pay_range_min`, `pay_range_max` | Dual-handle slider |

### 5.2 Filter UI Variants

**Variant A: Sidebar Filters (Desktop)**
```
┌──── Filters ────┐  ┌──── Results ──────────────────┐
│                  │  │                                │
│ PILLAR           │  │ 32 jobs found · Sort: Newest ▾ │
│ ☑ Earn (18)      │  │                                │
│ ☐ Grow (12)      │  │ ┌────────┐ ┌────────┐ ┌──────┐│
│ ☐ Shape (6)      │  │ │ Job 1  │ │ Job 2  │ │ Job 3││
│                  │  │ └────────┘ └────────┘ └──────┘│
│ JOB TYPE         │  │ ┌────────┐ ┌────────┐ ┌──────┐│
│ ☑ Annotation (8) │  │ │ Job 4  │ │ Job 5  │ │ Job 6││
│ ☐ Data Coll. (6) │  │ └────────┘ └────────┘ └──────┘│
│ ☐ Translation(4) │  │                                │
│ ☐ Transcription  │  │ [Load More] or pagination      │
│ ☐ Judging        │  │                                │
│ ☐ LLM Authoring  │  └────────────────────────────────┘
│                  │
│ DIFFICULTY       │
│ ○ All            │
│ ○ Entry (12)     │
│ ○ Intermediate   │
│ ○ Expert (6)     │
│                  │
│ PAY RANGE        │
│ $5 ●━━━━━━● $80  │
│                  │
│ LOCATION         │
│ ☑ Worldwide (24) │
│ ☐ US (8)         │
│ ☐ EU (4)         │
│                  │
│ [Clear Filters]  │
└──────────────────┘
```

**Variant B: Top Bar Filters (Mobile-First)**
```
┌──────────────────────────────────────────┐
│ 🔍 Search...                             │
├──────────────────────────────────────────┤
│ [Earn ✕] [Grow ✕] [Shape]  [Filters ▾]  │
│ [Annotation ✕]  [Worldwide]  [Entry]     │
├──────────────────────────────────────────┤
│ 12 jobs  ·  Sort: Newest ▾              │
│ ┌────────────────────────────────────┐   │
│ │ Job Card 1                         │   │
│ └────────────────────────────────────┘   │
│ ┌────────────────────────────────────┐   │
│ │ Job Card 2                         │   │
│ └────────────────────────────────────┘   │
```

**Recommendation:** Use **Variant B (top bar)** as the primary — mobile-first, less layout complexity, selected filters visible as removable chips.

### 5.3 Filter Counts

Each filter option shows the number of matching results in parentheses. Counts update live as other filters are applied (cross-filter counting).

Example: If "Earn" pillar is selected, "Annotation (8)" shows 8 annotation jobs within Earn, not the total annotation count.

### 5.4 Active Filter Pills

Selected filters appear as removable pills above the results:

```
Active: [Earn ✕] [Annotation ✕] [Worldwide ✕]  ·  Clear All
```

Clicking ✕ removes that filter and refreshes results via AJAX.

### 5.5 URL State Sync

Every filter change updates the URL without page reload:

```
/jobs/?pillar=earn&type=annotation&location=worldwide&difficulty=entry&sort=newest&page=1
```

This means:
- Results are bookmarkable
- Browser back/forward works
- Sharing a filtered URL shows the same results
- SEO-friendly (Google can crawl filtered pages)

---

## 6. AJAX Live Job Browser

### 6.1 Architecture

```
┌─────────────────┐     ┌────────────────────┐     ┌──────────────┐
│  User clicks     │────▶│  JavaScript        │────▶│  WP REST API │
│  filter/search   │     │  (fetch + render)  │     │  /wp-json/   │
│                  │◀────│                    │◀────│  of/v1/jobs  │
│  DOM updated     │     │  History.pushState │     │              │
│  URL updated     │     │  (URL sync)        │     │              │
└─────────────────┘     └────────────────────┘     └──────────────┘
```

### 6.2 Custom REST API Endpoint

Register a dedicated endpoint for the job browser — faster and more flexible than the default `wp/v2/job` endpoint.

**Endpoint:** `GET /wp-json/of/v1/jobs`

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Full-text search query |
| `pillar` | string (csv) | Filter by pillar(s): `earn,grow` |
| `type` | string (csv) | Filter by job_type: `annotation,translation` |
| `location` | string (csv) | Filter by location tags: `worldwide,us` |
| `compensation` | string (csv) | Filter by compensation tags |
| `difficulty` | string | `entry`, `intermediate`, `expert` |
| `commitment` | string | `flexible`, `part-time`, `full-time`, `one-time` |
| `status` | string | `actively-hiring`, `waitlist`, `starting-soon` |
| `language` | string | Language search |
| `pay_min` | number | Minimum pay rate |
| `pay_max` | number | Maximum pay rate |
| `featured` | boolean | Only featured jobs |
| `urgent` | boolean | Only urgent jobs |
| `sort` | string | `newest`, `oldest`, `az`, `za`, `pay_high`, `pay_low`, `trending` |
| `per_page` | int | Results per page (default 9) |
| `page` | int | Page number |

**Response:**
```json
{
  "jobs": [
    {
      "id": 12345,
      "title": "Jellyfish – Voice Assistant Conversation Annotation",
      "slug": "jellyfish-voice-assistant-conversation-annotation",
      "url": "/jobs/jellyfish-voice-assistant-conversation-annotation/",
      "excerpt": "Help us improve Voice Assistant technology...",
      "pillar": "earn",
      "job_type": "Annotation",
      "job_tags": ["Worldwide", "Fixed Rate Per Hour"],
      "location_display": "Worldwide",
      "compensation_display": "Fixed Rate Per Hour",
      "difficulty_level": "entry",
      "time_commitment": "flexible",
      "project_status": "actively-hiring",
      "pay_range": "$10-15/hr",
      "card_highlight": "$10-15/hr · Remote",
      "is_featured": false,
      "is_urgent": false,
      "spots_remaining": null,
      "workers_active": 247,
      "date": "2026-04-15T10:00:00Z",
      "views_7d": 342
    }
  ],
  "total": 46,
  "pages": 6,
  "page": 1,
  "per_page": 9,
  "facets": {
    "pillar": {"earn": 18, "grow": 12, "shape": 6},
    "job_type": {"Annotation": 8, "Data Collection": 12, "Translation": 6, "Transcription": 4, "Judging": 3, "LLM Prompt Authoring": 1},
    "location": {"Worldwide": 24, "US": 8, "Selected Locations": 6},
    "difficulty": {"entry": 20, "intermediate": 14, "expert": 6},
    "compensation": {"Fixed Rate Per Hour": 22, "Fixed Rate Upon Completion": 12, "Fixed Rate Per Approved Asset": 2}
  }
}
```

**Key feature:** The `facets` object returns live counts for every filter dimension, already filtered by currently active filters. This powers the "(8)" counts next to each filter option.

### 6.3 Infinite Scroll vs. Pagination

**Recommendation:** Offer both, user-selectable.

| Mode | Behavior | Best For |
|---|---|---|
| **Pagination** (default) | Traditional numbered pages, 9 per page | SEO (Google crawls pages), power users who want specific page |
| **Load More** | Button at bottom loads next 9 | Casual browsers, mobile |
| **Infinite Scroll** | Auto-loads on scroll near bottom | Exploration mode, "I'm just browsing" |

**User toggle:** Small control in the results header:
```
46 jobs · Sort: Newest ▾ · View: [Grid] [List] · Load: [Pages] [More] [∞]
```

### 6.4 View Modes

| Mode | Layout | Best For |
|---|---|---|
| **Grid** (default) | 3-column card grid (desktop) | Visual browsing |
| **List** | Single-column full-width rows | Detailed scanning |
| **Compact** | Dense table-like rows | Power users comparing many jobs |

---

## 7. Smart Recommendation Engine

### 7.1 "Similar Jobs" (Single Job Page)

On every single job page, show a "Similar Jobs" section below the content.

**Algorithm:**
1. Same `job_type` taxonomy (strongest signal)
2. Same `pillar` (secondary signal)
3. Same `difficulty_level` (tertiary signal)
4. Exclude current job
5. Prefer `is_featured = true`
6. Limit to 3

**Shortcode:**
```
[similar_jobs count="3" columns="3"]
```

### 7.2 "Based on Your Interests" (Homepage / Archive)

Track which jobs and pillars the user has viewed (via `_of_vid` session cookie) and show personalized recommendations.

**Tracking (in `oneforma-jobs.js`):**
```javascript
// On each job page view, store interest
const interests = JSON.parse(localStorage.getItem('of_interests') || '{}');
const jobData = {
    type: document.querySelector('[data-job-type]')?.dataset.jobType,
    pillar: document.querySelector('[data-pillar]')?.dataset.pillar,
    difficulty: document.querySelector('[data-difficulty]')?.dataset.difficulty,
    timestamp: Date.now()
};
interests[window.location.pathname] = jobData;
// Keep last 20 views
const entries = Object.entries(interests);
if (entries.length > 20) {
    const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    localStorage.setItem('of_interests', JSON.stringify(Object.fromEntries(sorted.slice(0, 20))));
} else {
    localStorage.setItem('of_interests', JSON.stringify(interests));
}
```

**Recommendation logic (client-side):**
1. Count most-viewed `pillar` → primary filter
2. Count most-viewed `job_type` → secondary filter
3. Fetch from `/wp-json/of/v1/jobs?pillar={top}&type={top2}&per_page=3&sort=newest`
4. Exclude already-viewed jobs
5. Display as "Recommended for You" slider

**Shortcode:**
```
[recommended_jobs count="3" fallback="featured"]
```

The `fallback="featured"` means: if user has no browsing history (first visit), show featured jobs instead.

### 7.3 "People Also Viewed" (Single Job Page)

Track co-viewing patterns: users who viewed Job A also viewed Jobs B, C, D.

**Implementation (lightweight, no external service):**
```php
// When a user views a job, log their session + job_id
// Then query: "What other jobs were viewed in sessions that also viewed this job?"
```

**Simpler approach for V1:** Just use "Similar Jobs" based on taxonomy overlap. Upgrade to co-viewing later if traffic volume justifies it.

### 7.4 "You Might Also Like" Email Digest

Weekly email with 3 job recommendations based on profile interests. Requires email integration (Brevo/Mailchimp) + subscriber preferences.

---

## 8. Job Cards Design System

### 8.1 Card Variants

#### Standard Card (Grid View)

```
┌──────────────────────────────────┐
│  ┌──────┐ ┌─────────────┐       │
│  │ EARN │ │ Annotation  │       │
│  └──────┘ └─────────────┘       │
│                                  │
│  Jellyfish – Voice Assistant     │
│  Conversation Annotation         │
│                                  │
│  📍 Worldwide · 💰 $10-15/hr     │
│  🕐 Flexible  · 📊 Entry         │
│                                  │
│  Help us improve Voice           │
│  Assistant technology by...      │
│                                  │
│  ─────────────────────────────── │
│  [Learn More →]    🟢 Hiring     │
└──────────────────────────────────┘
```

#### Featured Card (Carousel/Hero)

```
┌────────────────────────────────────────────┐
│  🔥 FEATURED                                │
│                                             │
│  Jellyfish – Voice Assistant                │
│  Conversation Annotation                    │
│                                             │
│  "Your fluency shapes how AI talks          │
│   to 30M people worldwide."                 │
│                                             │
│  ┌───────────────┬──────────────────────┐   │
│  │ 📍 Worldwide  │ 💰 $10-15/hr         │   │
│  │ 🕐 Flexible   │ 📊 Entry Level       │   │
│  │ 👥 247 active  │ 🎯 12 spots left     │   │
│  └───────────────┴──────────────────────┘   │
│                                             │
│  [Apply Now →]                [Learn More]  │
└─────────────────────────────────────────────┘
```

#### Minimal Card (Compact/Strip)

```
┌──────────────────────────────────────────────────────────────┐
│ ● Jellyfish Annotation │ EARN │ Worldwide │ $10-15/hr │ [→] │
└──────────────────────────────────────────────────────────────┘
```

#### List Row (List View)

```
┌──────────────────────────────────────────────────────────────┐
│  [EARN] [Annotation]                                         │
│                                                              │
│  Jellyfish – Voice Assistant Conversation Annotation         │
│  Help us improve Voice Assistant technology by training AI   │
│  systems to better understand and respond to natural user... │
│                                                              │
│  📍 Worldwide · 💰 $10-15/hr · 🕐 Flexible · 📊 Entry       │
│  🟢 Actively Hiring · 👥 247 workers · Published 3 days ago  │
│                                                              │
│  [Apply Now →]  [Learn More]  [Save ♡]                      │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Pillar Color Coding

| Pillar | Badge Color | CSS Class |
|---|---|---|
| **EARN** | `#0693E3` (cyan-blue) | `.of-badge-earn` |
| **GROW** | `#9B51E0` (purple) | `.of-badge-grow` |
| **SHAPE** | `#32373C` (charcoal, gold border) | `.of-badge-shape` |

### 8.3 Status Indicators

| Status | Indicator | Color |
|---|---|---|
| Actively Hiring | 🟢 solid dot + "Hiring" | Green `#22C55E` |
| Starting Soon | 🟡 dot + "Starting Soon" | Amber `#F59E0B` |
| Waitlist | 🔵 dot + "Waitlist" | Blue `#3B82F6` |
| Completed | ⚫ dot + "Completed" | Gray `#9CA3AF` |

### 8.4 Urgency/Scarcity Elements

| Condition | Display |
|---|---|
| `is_urgent = true` | 🔥 "Urgent" badge, red border accent |
| `spots_remaining <= 10` | "Only {n} spots left" in red text |
| Published < 48 hours ago | "🆕 New" badge |
| `is_featured = true` | ⭐ "Featured" badge, elevated shadow |

### 8.5 Card CSS

```css
/* Base card */
.of-job-card {
    background: #FFFFFF;
    border: 1px solid #E5E5E5;
    border-radius: 12px;
    padding: 1.5rem;
    transition: box-shadow 0.2s, transform 0.15s;
    cursor: pointer;
    position: relative;
}

.of-job-card:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    transform: translateY(-2px);
}

/* Urgent card */
.of-job-card.is-urgent {
    border-left: 4px solid #EF4444;
}

/* Featured card */
.of-job-card.is-featured {
    box-shadow: 0 4px 16px rgba(6,147,227,0.15);
    border: 1px solid rgba(6,147,227,0.3);
}

/* Pillar badges */
.of-badge-earn { background: #0693E3; color: #fff; }
.of-badge-grow { background: #9B51E0; color: #fff; }
.of-badge-shape { background: #32373C; color: #fff; border: 1px solid #C9A84C; }

/* Meta row */
.of-job-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0.75rem 0;
    font-size: 0.8125rem;
    color: #737373;
}

.of-job-meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
}

/* Status dot */
.of-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 4px;
}

.of-status-hiring { background: #22C55E; }
.of-status-soon { background: #F59E0B; }
.of-status-waitlist { background: #3B82F6; }
.of-status-completed { background: #9CA3AF; }

/* Scarcity text */
.of-spots-left {
    font-size: 0.75rem;
    font-weight: 600;
    color: #EF4444;
}
```

---

## 9. Interactive Job Map

### 9.1 Concept

A visual world map showing where jobs are available. Users click a region to filter jobs.

### 9.2 Implementation

**Lightweight SVG map** (not Google Maps — no API key needed, faster, smaller).

Library: **jVectorMap** (open source) or custom SVG with click handlers.

**Regions:**
- North America
- Latin America
- Europe
- Middle East & Africa
- South Asia
- East & Southeast Asia
- Oceania
- Worldwide (highlighted differently)

**Behavior:**
1. Map shows colored dots/regions where jobs exist
2. Hover shows tooltip: "Europe: 12 jobs available"
3. Click filters job grid to that region
4. "Worldwide" jobs appear in all regions
5. Multiple regions selectable

**Shortcode:**
```
[job_map height="400px" show_counts="true"]
```

### 9.3 Placement

- Homepage: above or beside the job category grid
- `/jobs/` archive: above the filter bar
- `/earn` hub: showing "Where our community earns" (social proof)

---

## 10. Job Comparison Tool

### 10.1 Concept

Users can select 2-3 jobs and compare them side-by-side.

### 10.2 UI Flow

1. On each job card, a "Compare" checkbox/button appears
2. A sticky comparison bar appears at the bottom when 1+ jobs selected:
   ```
   ┌────────────────────────────────────────────────────────┐
   │  Compare: [Jellyfish ✕] [Mosaic ✕] [+Add]  [Compare →]│
   └────────────────────────────────────────────────────────┘
   ```
3. Clicking "Compare" opens a comparison modal/page:

```
┌───────────────────┬───────────────────┬───────────────────┐
│                   │ Jellyfish         │ Mosaic            │
├───────────────────┼───────────────────┼───────────────────┤
│ Pillar            │ 🔵 Earn           │ 🔵 Earn           │
│ Type              │ Annotation        │ Data Collection   │
│ Location          │ 📍 Worldwide      │ 📍 US (3 cities)  │
│ Pay               │ 💰 $10-15/hr      │ 💰 $75 per session│
│ Difficulty        │ 📊 Entry          │ 📊 Entry          │
│ Time              │ 🕐 Flexible       │ 🕐 One-time       │
│ Status            │ 🟢 Hiring         │ 🟢 Hiring         │
│ Languages         │ Swiss IT, Swiss FR│ English           │
│ Workers Active    │ 247               │ 34                │
│ Spots Left        │ Unlimited         │ 150               │
├───────────────────┼───────────────────┼───────────────────┤
│                   │ [Apply →]         │ [Apply →]         │
└───────────────────┴───────────────────┴───────────────────┘
```

### 10.3 Implementation

- Store selected job IDs in `localStorage`
- Comparison bar is a fixed-position element managed by `oneforma-jobs.js`
- Comparison view fetches job data from `/wp-json/of/v1/jobs?include=123,456` and renders client-side
- Max 3 jobs in comparison

---

## 11. Micro-Interactions & UX Polish

### 11.1 Save/Bookmark Jobs

Heart icon on each card. Saves job ID to `localStorage` for anonymous users.

```javascript
// Save job
document.querySelectorAll('.of-save-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const jobId = btn.dataset.jobId;
        const saved = JSON.parse(localStorage.getItem('of_saved_jobs') || '[]');
        const index = saved.indexOf(jobId);
        if (index > -1) {
            saved.splice(index, 1);
            btn.classList.remove('is-saved');
        } else {
            saved.push(jobId);
            btn.classList.add('is-saved');
        }
        localStorage.setItem('of_saved_jobs', JSON.stringify(saved));
    });
});
```

**Saved Jobs Page:** `/jobs/saved` shows bookmarked jobs (client-side rendering from localStorage).

### 11.2 Recently Viewed

Show "Recently Viewed" strip on job archive and homepage:

```
[recently_viewed_jobs count="4" style="minimal"]
```

Reads from localStorage history (same data as the recommendation engine).

### 11.3 "Back to Results" Smart Navigation

When user goes from job archive → single job → back, preserve their scroll position and active filters.

```javascript
// Before navigating to single job
sessionStorage.setItem('of_scroll_position', window.scrollY);
sessionStorage.setItem('of_active_filters', JSON.stringify(currentFilters));

// On archive page load, restore
const savedScroll = sessionStorage.getItem('of_scroll_position');
if (savedScroll && document.referrer.includes('/jobs/')) {
    window.scrollTo(0, parseInt(savedScroll));
}
```

### 11.4 Skeleton Loading States

While AJAX results load, show animated skeleton cards:

```css
.of-skeleton-card {
    background: #F5F5F5;
    border-radius: 12px;
    padding: 1.5rem;
    animation: skeleton-pulse 1.5s infinite;
}

.of-skeleton-line {
    height: 14px;
    background: #E5E5E5;
    border-radius: 7px;
    margin-bottom: 0.75rem;
}

.of-skeleton-line.short { width: 40%; }
.of-skeleton-line.medium { width: 70%; }
.of-skeleton-line.long { width: 100%; }

@keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

### 11.5 Empty State

When no jobs match filters:

```
┌──────────────────────────────────────────┐
│                                          │
│        🔍 No jobs match your filters     │
│                                          │
│   Try removing some filters or           │
│   broadening your search.                │
│                                          │
│   [Clear All Filters]                    │
│                                          │
│   ── Or explore these popular options ── │
│                                          │
│   [View All Jobs]  [Earn Jobs]           │
│   [Grow Jobs]      [Shape Jobs]          │
│                                          │
└──────────────────────────────────────────┘
```

### 11.6 Results Count Animation

When filter changes update the count, animate the number:

```javascript
function animateCount(element, from, to, duration = 300) {
    const start = performance.now();
    const step = (timestamp) => {
        const progress = Math.min((timestamp - start) / duration, 1);
        const current = Math.round(from + (to - from) * progress);
        element.textContent = current;
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
```

---

## 12. Implementation Approach

### 12.1 Plugin Architecture

All dynamic job features live in a single must-use plugin:

```
/wp-content/mu-plugins/
└── oneforma-helpers.php          ← Main plugin loader
    (includes the files below from a subfolder)

/wp-content/mu-plugins/oneforma/
├── shortcodes/
│   ├── job-slider.php            ← [job_slider] shortcode
│   ├── job-search.php            ← [job_search] shortcode
│   ├── featured-carousel.php     ← [featured_jobs_carousel]
│   ├── trending-jobs.php         ← [trending_jobs]
│   ├── similar-jobs.php          ← [similar_jobs]
│   ├── recommended-jobs.php      ← [recommended_jobs]
│   ├── recently-viewed.php       ← [recently_viewed_jobs]
│   ├── job-map.php               ← [job_map]
│   └── job-apply-buttons.php     ← [job_apply_buttons] (existing)
├── rest-api/
│   └── jobs-endpoint.php         ← /wp-json/of/v1/jobs
├── assets/
│   ├── css/
│   │   ├── job-cards.css         ← Card design system
│   │   ├── job-search.css        ← Search UI styles
│   │   ├── job-filters.css       ← Filter UI styles
│   │   └── job-slider.css        ← Slider styles
│   └── js/
│       ├── swiper.min.js         ← Swiper library (CDN or bundled)
│       ├── job-browser.js        ← AJAX browser, filters, URL sync
│       ├── job-search.js         ← Instant search
│       ├── job-compare.js        ← Comparison tool
│       ├── job-save.js           ← Save/bookmark
│       └── job-recommendations.js← Client-side recommendations
├── schema/
│   └── job-posting-schema.php    ← JobPosting structured data
└── admin/
    └── job-fields-setup.php      ← ACF field group registration (code-based)
```

### 12.2 Asset Loading Strategy

Only load JS/CSS on pages that use them:

```php
add_action('wp_enqueue_scripts', function() {
    // Swiper — only on pages with sliders
    if (is_front_page() || is_post_type_archive('job') || is_singular('job') || has_shortcode_in_content('job_slider')) {
        wp_enqueue_style('swiper', 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css');
        wp_enqueue_script('swiper', 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js', [], null, true);
    }
    
    // Job browser — only on archive pages
    if (is_post_type_archive('job') || is_tax('job_type') || is_tax('pillar')) {
        wp_enqueue_script('of-job-browser', plugin_dir_url(__FILE__) . 'assets/js/job-browser.js', [], '1.0', true);
        wp_localize_script('of-job-browser', 'ofJobs', [
            'apiUrl' => rest_url('of/v1/jobs'),
            'nonce' => wp_create_nonce('wp_rest'),
        ]);
    }
    
    // Job cards — on any page with job display
    if (is_front_page() || is_post_type_archive('job') || is_singular('job')) {
        wp_enqueue_style('of-job-cards', plugin_dir_url(__FILE__) . 'assets/css/job-cards.css');
    }
});
```

### 12.3 Elementor Integration

Each shortcode works inside Elementor's **Shortcode Widget**. This means:

1. Build job archive page in Elementor
2. Drop in `[job_search]` shortcode at the top
3. Drop in `[job_browser]` shortcode for the main results area (handles its own grid/list/filters)
4. Drop in `[job_slider pillar="earn"]` on pillar hubs
5. Drop in `[similar_jobs]` on single job template

**Alternatively**, for tighter Elementor integration, register custom Elementor widgets that wrap each shortcode — giving visual controls in the Elementor editor.

---

## 13. REST API Endpoints

### 13.1 Job Search & Filter Endpoint

```
GET /wp-json/of/v1/jobs
```

Full specification in Section 6.2 above. Returns jobs + facet counts.

### 13.2 Job Suggestions Endpoint

```
GET /wp-json/of/v1/jobs/suggest?q={query}
```

Returns categorized suggestions for autocomplete:

```json
{
  "categories": [
    {"name": "Translation", "count": 6, "url": "/jobs/type/translation"}
  ],
  "jobs": [
    {"id": 123, "title": "Vega Transcription", "url": "/jobs/vega-transcription/"}
  ],
  "skills": ["Translating", "Transcript Review"]
}
```

### 13.3 Facets-Only Endpoint

```
GET /wp-json/of/v1/jobs/facets?pillar=earn
```

Returns only facet counts (for filter UI updates without re-fetching jobs):

```json
{
  "pillar": {"earn": 18, "grow": 12, "shape": 6},
  "job_type": {"Annotation": 8, "Data Collection": 6},
  "difficulty": {"entry": 12, "intermediate": 4, "expert": 2}
}
```

### 13.4 Trending Endpoint

```
GET /wp-json/of/v1/jobs/trending?period=7d&limit=5
```

Returns most-viewed jobs in the given period.

---

## 14. Complete Code: oneforma-jobs.php

The core REST API endpoint registration (the most critical piece):

```php
<?php
/**
 * OneForma Jobs REST API — /wp-json/of/v1/jobs
 *
 * High-performance job search, filter, and faceted browsing endpoint.
 * Powers the AJAX job browser, search, and all dynamic job displays.
 */

add_action('rest_api_init', function() {
    register_rest_route('of/v1', '/jobs', [
        'methods' => 'GET',
        'callback' => 'of_get_jobs',
        'permission_callback' => '__return_true',
        'args' => [
            'search'       => ['type' => 'string', 'default' => ''],
            'pillar'       => ['type' => 'string', 'default' => ''],
            'type'         => ['type' => 'string', 'default' => ''],
            'location'     => ['type' => 'string', 'default' => ''],
            'compensation' => ['type' => 'string', 'default' => ''],
            'difficulty'   => ['type' => 'string', 'default' => ''],
            'commitment'   => ['type' => 'string', 'default' => ''],
            'status'       => ['type' => 'string', 'default' => ''],
            'language'     => ['type' => 'string', 'default' => ''],
            'pay_min'      => ['type' => 'number', 'default' => 0],
            'pay_max'      => ['type' => 'number', 'default' => 0],
            'featured'     => ['type' => 'boolean', 'default' => false],
            'urgent'       => ['type' => 'boolean', 'default' => false],
            'sort'         => ['type' => 'string', 'default' => 'newest'],
            'per_page'     => ['type' => 'integer', 'default' => 9, 'maximum' => 50],
            'page'         => ['type' => 'integer', 'default' => 1],
            'include'      => ['type' => 'string', 'default' => ''],
        ],
    ]);

    register_rest_route('of/v1', '/jobs/suggest', [
        'methods' => 'GET',
        'callback' => 'of_suggest_jobs',
        'permission_callback' => '__return_true',
        'args' => [
            'q' => ['type' => 'string', 'required' => true],
        ],
    ]);
});

function of_get_jobs(WP_REST_Request $request): WP_REST_Response {
    $args = [
        'post_type'      => 'job',
        'post_status'    => 'publish',
        'posts_per_page' => $request['per_page'],
        'paged'          => $request['page'],
    ];

    // Specific IDs (for comparison tool)
    if ($request['include']) {
        $args['post__in'] = array_map('intval', explode(',', $request['include']));
        $args['orderby'] = 'post__in';
    }

    // Search
    if ($request['search']) {
        $args['s'] = sanitize_text_field($request['search']);
    }

    // Taxonomy queries
    $tax_query = [];

    if ($request['pillar']) {
        $tax_query[] = [
            'taxonomy' => 'pillar',
            'field'    => 'slug',
            'terms'    => explode(',', $request['pillar']),
        ];
    }

    if ($request['type']) {
        $tax_query[] = [
            'taxonomy' => 'job_type',
            'field'    => 'slug',
            'terms'    => explode(',', $request['type']),
        ];
    }

    if ($request['location']) {
        $tax_query[] = [
            'taxonomy' => 'job_tag',
            'field'    => 'slug',
            'terms'    => explode(',', $request['location']),
        ];
    }

    if (count($tax_query) > 0) {
        $tax_query['relation'] = 'AND';
        $args['tax_query'] = $tax_query;
    }

    // Meta queries
    $meta_query = [];

    if ($request['difficulty']) {
        $meta_query[] = [
            'key'   => 'difficulty_level',
            'value' => sanitize_text_field($request['difficulty']),
        ];
    }

    if ($request['commitment']) {
        $meta_query[] = [
            'key'   => 'time_commitment',
            'value' => sanitize_text_field($request['commitment']),
        ];
    }

    if ($request['status']) {
        $meta_query[] = [
            'key'   => 'project_status',
            'value' => sanitize_text_field($request['status']),
        ];
    }

    if ($request['featured']) {
        $meta_query[] = ['key' => 'is_featured', 'value' => '1'];
    }

    if ($request['urgent']) {
        $meta_query[] = ['key' => 'is_urgent', 'value' => '1'];
    }

    if ($request['pay_min'] > 0) {
        $meta_query[] = [
            'key'     => 'pay_range_max',
            'value'   => $request['pay_min'],
            'compare' => '>=',
            'type'    => 'NUMERIC',
        ];
    }

    if ($request['pay_max'] > 0) {
        $meta_query[] = [
            'key'     => 'pay_range_min',
            'value'   => $request['pay_max'],
            'compare' => '<=',
            'type'    => 'NUMERIC',
        ];
    }

    if (count($meta_query) > 0) {
        $meta_query['relation'] = 'AND';
        $args['meta_query'] = $meta_query;
    }

    // Sort
    switch ($request['sort']) {
        case 'oldest':
            $args['orderby'] = 'date';
            $args['order'] = 'ASC';
            break;
        case 'az':
            $args['orderby'] = 'title';
            $args['order'] = 'ASC';
            break;
        case 'za':
            $args['orderby'] = 'title';
            $args['order'] = 'DESC';
            break;
        case 'pay_high':
            $args['meta_key'] = 'pay_range_max';
            $args['orderby'] = 'meta_value_num';
            $args['order'] = 'DESC';
            break;
        case 'pay_low':
            $args['meta_key'] = 'pay_range_min';
            $args['orderby'] = 'meta_value_num';
            $args['order'] = 'ASC';
            break;
        case 'trending':
            $args['meta_key'] = '_job_views_7d';
            $args['orderby'] = 'meta_value_num';
            $args['order'] = 'DESC';
            break;
        default: // newest
            $args['orderby'] = 'date';
            $args['order'] = 'DESC';
    }

    $query = new WP_Query($args);
    $jobs = [];

    foreach ($query->posts as $post) {
        $post_id = $post->ID;

        // Get taxonomy terms
        $job_types = wp_get_post_terms($post_id, 'job_type', ['fields' => 'names']);
        $job_tags = wp_get_post_terms($post_id, 'job_tag', ['fields' => 'names']);
        $pillars = wp_get_post_terms($post_id, 'pillar', ['fields' => 'slugs']);

        // Separate location and compensation from job_tags
        $comp_keywords = ['Fixed Rate Per Hour', 'Fixed Rate Per Approved Asset',
                          'Fixed Rate Upon Completion', 'Fixed Rate Per Source Word'];
        $locations = array_diff($job_tags, $comp_keywords);
        $compensations = array_intersect($job_tags, $comp_keywords);

        // Build pay range display
        $pay_min = get_field('pay_range_min', $post_id);
        $pay_max = get_field('pay_range_max', $post_id);
        $pay_display = '';
        if ($pay_min && $pay_max) {
            $pay_display = ($pay_min === $pay_max)
                ? '$' . $pay_min . '/hr'
                : '$' . $pay_min . '-' . $pay_max . '/hr';
        }

        $jobs[] = [
            'id'                   => $post_id,
            'title'                => $post->post_title,
            'slug'                 => $post->post_name,
            'url'                  => get_permalink($post_id),
            'excerpt'              => wp_trim_words(
                $post->post_excerpt ?: $post->post_content, 25, '...'
            ),
            'pillar'               => $pillars[0] ?? 'earn',
            'job_type'             => $job_types[0] ?? '',
            'locations'            => array_values($locations),
            'location_display'     => implode(', ', $locations) ?: 'Worldwide',
            'compensation_display' => $compensations[0] ?? '',
            'difficulty_level'     => get_field('difficulty_level', $post_id) ?: 'entry',
            'time_commitment'      => get_field('time_commitment', $post_id) ?: '',
            'project_status'       => get_field('project_status', $post_id) ?: 'actively-hiring',
            'pay_range_min'        => $pay_min,
            'pay_range_max'        => $pay_max,
            'pay_display'          => $pay_display,
            'card_highlight'       => get_field('card_highlight', $post_id) ?: $pay_display,
            'is_featured'          => (bool) get_field('is_featured', $post_id),
            'is_urgent'            => (bool) get_field('is_urgent', $post_id),
            'spots_remaining'      => get_field('spots_remaining', $post_id),
            'workers_active'       => get_field('workers_active', $post_id),
            'languages_needed'     => get_field('languages_needed', $post_id) ?: '',
            'date'                 => $post->post_date,
            'date_human'           => human_time_diff(strtotime($post->post_date)) . ' ago',
            'is_new'               => (time() - strtotime($post->post_date)) < 172800, // 48hrs
            'views_7d'             => (int) get_post_meta($post_id, '_job_views_7d', true),
        ];
    }

    // Build facets (counts for each filter dimension)
    $facets = of_build_facets($args);

    return new WP_REST_Response([
        'jobs'     => $jobs,
        'total'    => (int) $query->found_posts,
        'pages'    => (int) $query->max_num_pages,
        'page'     => (int) $request['page'],
        'per_page' => (int) $request['per_page'],
        'facets'   => $facets,
    ], 200);
}

function of_build_facets(array $base_args): array {
    // Remove pagination for facet counting
    $count_args = $base_args;
    $count_args['posts_per_page'] = -1;
    $count_args['fields'] = 'ids';

    $all_ids = get_posts($count_args);

    $facets = [
        'pillar'       => [],
        'job_type'     => [],
        'location'     => [],
        'difficulty'   => [],
        'compensation' => [],
        'commitment'   => [],
    ];

    foreach ($all_ids as $post_id) {
        // Pillar
        $pillars = wp_get_post_terms($post_id, 'pillar', ['fields' => 'slugs']);
        foreach ($pillars as $p) {
            $facets['pillar'][$p] = ($facets['pillar'][$p] ?? 0) + 1;
        }

        // Job type
        $types = wp_get_post_terms($post_id, 'job_type', ['fields' => 'names']);
        foreach ($types as $t) {
            $facets['job_type'][$t] = ($facets['job_type'][$t] ?? 0) + 1;
        }

        // Tags (split into location and compensation)
        $tags = wp_get_post_terms($post_id, 'job_tag', ['fields' => 'names']);
        $comp_keywords = ['Fixed Rate Per Hour', 'Fixed Rate Per Approved Asset',
                          'Fixed Rate Upon Completion', 'Fixed Rate Per Source Word'];
        foreach ($tags as $tag) {
            if (in_array($tag, $comp_keywords)) {
                $facets['compensation'][$tag] = ($facets['compensation'][$tag] ?? 0) + 1;
            } else {
                $facets['location'][$tag] = ($facets['location'][$tag] ?? 0) + 1;
            }
        }

        // Meta facets
        $diff = get_field('difficulty_level', $post_id);
        if ($diff) {
            $facets['difficulty'][$diff] = ($facets['difficulty'][$diff] ?? 0) + 1;
        }

        $commit = get_field('time_commitment', $post_id);
        if ($commit) {
            $facets['commitment'][$commit] = ($facets['commitment'][$commit] ?? 0) + 1;
        }
    }

    return $facets;
}

function of_suggest_jobs(WP_REST_Request $request): WP_REST_Response {
    $q = sanitize_text_field($request['q']);
    if (strlen($q) < 2) return new WP_REST_Response(['categories' => [], 'jobs' => [], 'skills' => []], 200);

    // Search job types
    $categories = [];
    $terms = get_terms(['taxonomy' => 'job_type', 'search' => $q, 'hide_empty' => true]);
    foreach ($terms as $term) {
        $categories[] = [
            'name'  => $term->name,
            'count' => $term->count,
            'url'   => get_term_link($term),
        ];
    }

    // Search jobs by title
    $jobs_query = new WP_Query([
        'post_type'      => 'job',
        'post_status'    => 'publish',
        's'              => $q,
        'posts_per_page' => 5,
        'orderby'        => 'relevance',
    ]);

    $jobs = [];
    foreach ($jobs_query->posts as $post) {
        $types = wp_get_post_terms($post->ID, 'job_type', ['fields' => 'names']);
        $pillars = wp_get_post_terms($post->ID, 'pillar', ['fields' => 'slugs']);
        $jobs[] = [
            'id'       => $post->ID,
            'title'    => $post->post_title,
            'url'      => get_permalink($post->ID),
            'job_type' => $types[0] ?? '',
            'pillar'   => $pillars[0] ?? 'earn',
        ];
    }

    return new WP_REST_Response([
        'categories' => $categories,
        'jobs'       => $jobs,
        'skills'     => [], // Future: skill-based suggestions
    ], 200);
}
```

---

## 15. Performance Considerations

### 15.1 Caching Strategy

| Component | Cache Method | TTL |
|---|---|---|
| REST API responses | WordPress Transients | 5 minutes |
| Facet counts | Transient, invalidated on job publish/update | 10 minutes |
| Job card HTML | Object cache (Redis/Memcached if available) | 5 minutes |
| Swiper.js | Cloudflare CDN | Immutable (version in URL) |
| Job views counter | Direct postmeta (no cache) | Real-time |

### 15.2 Transient Caching for API

```php
function of_get_jobs(WP_REST_Request $request): WP_REST_Response {
    // Build cache key from request params
    $cache_key = 'of_jobs_' . md5(serialize($request->get_params()));
    $cached = get_transient($cache_key);
    
    if ($cached !== false) {
        return new WP_REST_Response($cached, 200);
    }
    
    // ... existing query logic ...
    
    $response_data = ['jobs' => $jobs, 'total' => ..., 'facets' => ...];
    set_transient($cache_key, $response_data, 5 * MINUTE_IN_SECONDS);
    
    return new WP_REST_Response($response_data, 200);
}

// Invalidate cache when jobs are updated
add_action('save_post_job', function() {
    global $wpdb;
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_of_jobs_%'");
    $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_of_jobs_%'");
});
```

### 15.3 Lazy Loading

- Sliders below the fold: load Swiper.js only when section scrolls into viewport (Intersection Observer)
- Images: native `loading="lazy"` on all job card images
- Recommended/Similar sections: fetch via AJAX only when visible

### 15.4 Bundle Size Budget

| Asset | Max Size (gzipped) |
|---|---|
| Swiper.js | 45 KB |
| job-browser.js | 15 KB |
| job-search.js | 8 KB |
| job-compare.js | 5 KB |
| job-save.js | 2 KB |
| All CSS combined | 12 KB |
| **Total additional** | **~87 KB** |

This is acceptable given the current site already loads ~72 resources. The dynamic features replace the existing Slick.js (~43 KB) and custom theme JS, so the net increase is ~44 KB.

---

*Specification created April 28, 2026. This document defines all dynamic job display components for the OneForma Elementor Pro rebuild.*
