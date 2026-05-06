# OneForma.com — Elementor Pro Migration Plan

> **Created:** April 28, 2026
> **Author:** Steven Junop (Digital Marketing Manager, Centific / OneForma)
> **Status:** Draft — Pending Approval
> **Target:** Migrate https://www.oneforma.com/ from custom `oneforma2025` theme to Hello Elementor + Elementor Pro
> **Classification:** Internal — Confidential

---

## Table of Contents

1. [Objective](#1-objective)
2. [Current State Summary](#2-current-state-summary)
3. [Target State](#3-target-state)
4. [Risk Assessment](#4-risk-assessment)
5. [Pre-Migration Checklist](#5-pre-migration-checklist)
6. [Phased Migration Plan](#6-phased-migration-plan)
7. [Rollback Strategy](#7-rollback-strategy)
8. [Validation & QA Protocol](#8-validation--qa-protocol)
9. [Post-Migration Tasks](#9-post-migration-tasks)
10. [Timeline & Milestones](#10-timeline--milestones)
11. [Dependencies & Blockers](#11-dependencies--blockers)
12. [Stakeholder Sign-Off](#12-stakeholder-sign-off)

---

## 1. Objective

Replace the current custom `oneforma2025` WordPress theme with **Hello Elementor + Elementor Pro** to achieve:

1. **Faster page creation** — Marketing team can build and update pages without developer involvement
2. **Visual template management** — Job listings, help center, and landing pages managed via drag-and-drop Theme Builder
3. **Simplified content entry** — Job posts remain pure text entry via ACF fields; Elementor dynamic templates handle all visual rendering
4. **Reduced dev dependency** — No compiled CSS/JS pipeline; no custom PHP templates to maintain
5. **Pipeline continuity** — The centric-intake AI pipeline (`wp_rest_client.py`, `wp_job_publisher.py`) continues to publish jobs with zero code changes

### Non-Goals

- This migration does NOT affect the member portal at `my.oneforma.com`
- This migration does NOT change any analytics, tracking, or cookie consent implementations
- This migration does NOT modify the centric-intake worker or its WordPress integration code
- This migration does NOT change ACF field definitions, custom post types, or taxonomies

---

## 2. Current State Summary

| Component | Current |
|---|---|
| Theme | `oneforma2025` (fully custom, compiled CSS/JS pipeline) |
| Page Builder | None — all layouts are hardcoded PHP templates |
| Job Template | Custom `single-job.php` with ACF repeater rendering |
| Job Archive | Custom archive template with JS filter/sort |
| Help Center | Custom `template-help-center.php` with category sidebar |
| Domain Experts | Custom `template-domain-experts.php` |
| Forms | Contact Form 7 + CF7 Conditional Fields |
| Slider | Slick.js (bundled in theme) |
| Icons | Custom SVG icons in theme + Font Awesome 6.7.2 CDN |
| Fonts | Roboto (self-hosted in theme, 5 weights, woff/woff2) |
| CSS | Single compiled `styles.min.css` (no framework) |
| JS | Single compiled `scripts.min.js` + Slick.js |

**Reference:** Full audit at `docs/oneforma-website-technical-audit.md`

---

## 3. Target State

| Component | Target |
|---|---|
| Theme | Hello Elementor (free, minimal base) |
| Page Builder | Elementor Pro (Theme Builder, Dynamic Content, Forms) |
| Custom Fields | ACF Pro (existing fields preserved, Elementor integration enabled) |
| Job Template | Elementor Theme Builder → Single `job` CPT template with Dynamic Tags |
| Job Archive | Elementor Theme Builder → Archive `job` template with Posts widget + taxonomy filters |
| Help Center | Elementor Theme Builder → Single `faq` CPT template + Archive template |
| Domain Experts | Elementor page with embedded Elementor Form |
| Forms | Elementor Pro Forms (migrate from CF7) OR retain CF7 via shortcode widgets |
| Slider | Elementor Carousel / Slides widget (replace Slick.js) |
| Icons | Elementor built-in icon library (includes Font Awesome) + uploaded custom SVGs |
| Fonts | Google Fonts via Elementor (Roboto) OR self-hosted via Hello Elementor settings |
| CSS | Elementor-generated styles + Global Styles for design tokens |
| JS | Elementor-generated scripts only (no custom JS needed) |

---

## 4. Risk Assessment

### Risk Matrix

| # | Risk | Likelihood | Impact | Severity | Mitigation |
|---|---|---|---|---|---|
| R1 | ACF Repeater fields don't render in Elementor template | Medium | High | **High** | Pre-build custom widget or shortcode for `apply_job` repeater before migration |
| R2 | Job archive filter/sort functionality lost | Medium | Medium | **Medium** | Rebuild using Elementor Posts widget with taxonomy query + custom JS if needed |
| R3 | SEO rankings affected by template change | Low | High | **Medium** | Preserve all URLs, meta tags, schema markup; Yoast handles this independently |
| R4 | centric-intake pipeline breaks after theme switch | Very Low | Critical | **Medium** | Pipeline writes via REST API (theme-independent); validate with test publish |
| R5 | Page speed regression from Elementor overhead | Medium | Medium | **Medium** | Enable Elementor performance optimizations; monitor Core Web Vitals |
| R6 | Cookie consent banner breaks | Very Low | Medium | **Low** | hu-manity.co is theme-independent; inject via `<head>` |
| R7 | Analytics tracking stops firing | Very Low | High | **Low** | GTM/SGTM injects via `<head>` independently of theme |
| R8 | Help center search functionality lost | Low | Low | **Low** | WordPress native search works; add Elementor Search widget |
| R9 | Custom SVG icons missing after migration | Medium | Low | **Low** | Upload all SVGs to media library; use Elementor SVG Icon widget |
| R10 | Social sharing buttons missing on job pages | Low | Low | **Low** | Use Elementor Share Buttons widget or install lightweight sharing plugin |

### Critical Path Risks

The only **critical-path risk** is **R1 (ACF Repeater rendering)**. This must be resolved and tested before any production migration begins. All other risks have straightforward mitigations.

---

## 5. Pre-Migration Checklist

### 5.1 Environment Setup

- [ ] **Create staging environment** — Clone production site to staging subdomain (e.g., `staging.oneforma.com`) or local environment
- [ ] **Full site backup** — Database + files via hosting panel or WP backup plugin
- [ ] **Document current plugin versions** — Freeze plugin updates during migration
- [ ] **Export Redirection plugin data** — JSON export of all redirects as safety backup
- [ ] **Export Yoast SEO settings** — Screenshot/export all Yoast configuration
- [ ] **Screenshot every page** — Visual reference for 1:1 rebuild validation

### 5.2 Plugin Acquisition

- [ ] **Elementor Pro license** — Purchase/activate ($59/yr single site or $199/yr for agency)
- [ ] **Verify ACF Pro** — Confirm ACF Pro (not free ACF) is installed; repeater fields require Pro
- [ ] **Verify ACF Pro version** — Must be 6.x+ for Elementor Dynamic Tags integration

### 5.3 Asset Inventory

- [ ] **Download all custom SVG icons** from `/wp-content/themes/oneforma2025/assets/images/`
  - `annotation-icon.svg`
  - `data-collection-icon.svg`
  - `judging-icon.svg`
  - `transcription-icon.svg`
  - `translation-icon.svg`
  - `location-icon.svg`
  - `dollar-icon.svg`
  - `community-icon.svg`
  - `certificate-icon.svg`
  - `explore-icon.svg`
  - `ai-chip-icon.svg`
  - `earn-icon.svg`
  - `stats-bg-image.jpg`
- [ ] **Download logo files** — `oneforma-logo.svg`, `oneforma-logo-white.png`
- [ ] **Upload all assets to WordPress Media Library** — Required for Elementor widgets

### 5.4 Pre-Build the ACF Repeater Solution

Before any migration work begins, build and test one of these solutions on the current theme:

- [ ] **Option A (Recommended):** Register `[job_apply_buttons]` shortcode in a site-specific plugin
- [ ] **Option B:** Build custom Elementor widget (`Job_Apply_Buttons_Widget`)
- [ ] **Option C:** Install Dynamic.ooo plugin for native ACF Repeater widget
- [ ] **Test chosen solution** — Verify it renders `apply_job` repeater correctly on a test job

---

## 6. Phased Migration Plan

### Phase 0: Foundation (Day 1)

**Goal:** Install all plugins, configure global settings, solve the ACF repeater problem.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 0.1 | Install Hello Elementor theme on staging (do NOT activate yet) | Dev | 5 min | Staging env ready |
| 0.2 | Install Elementor Pro on staging | Dev | 10 min | License key |
| 0.3 | Verify ACF Pro is installed and active | Dev | 5 min | — |
| 0.4 | Build ACF Repeater solution (shortcode or widget) | Dev | 1 hr | ACF Pro active |
| 0.5 | Test repeater solution on existing theme with a test job | Dev | 30 min | 0.4 complete |
| 0.6 | Upload all SVG icons + logos to Media Library | Dev | 15 min | Asset inventory |
| 0.7 | Activate Hello Elementor theme on staging | Dev | 5 min | 0.1–0.6 complete |
| 0.8 | Configure Elementor Global Settings (colors, fonts, buttons) | Dev | 30 min | 0.7 complete |

**Exit criteria:** Hello Elementor active on staging, global design tokens configured, ACF repeater solution tested and working.

---

### Phase 1: Global Templates (Day 1–2)

**Goal:** Build the header, footer, and global elements that appear on every page.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 1.1 | **Header template** — Logo, nav menu (How OneForma Works, Domain Experts, Jobs), Log In + Join buttons | Dev | 1.5 hr | Phase 0 |
| 1.2 | **Footer template** — Logo, nav links, social icons (LinkedIn, Instagram, Facebook, X), legal links, copyright | Dev | 1 hr | Phase 0 |
| 1.3 | **404 page template** | Dev | 15 min | Phase 0 |
| 1.4 | **Mobile responsive testing** — Header hamburger menu, footer stacking | Dev | 30 min | 1.1, 1.2 |

**Exit criteria:** Header and footer render identically to current site on desktop and mobile.

---

### Phase 2: Job Templates (Day 2–3) — CRITICAL PATH

**Goal:** Build the job listing system — the most important functionality on the site.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 2.1 | **Single Job template** (Theme Builder → Conditions: `job` CPT) | Dev | 2.5 hr | Phase 1 |
|  | — Dynamic Tag: Post Title | | | |
|  | — Dynamic Tag: `job_type` taxonomy badge | | | |
|  | — Dynamic Tags: `job_tag` location + compensation badges | | | |
|  | — Dynamic Tag: Post Content (HTML from editor) | | | |
|  | — ACF Repeater: `apply_job` section (via shortcode/widget) | | | |
|  | — Share Buttons widget (LinkedIn, X, Facebook) | | | |
|  | — Dual "Apply for this job" CTAs | | | |
| 2.2 | **Job Archive template** (Theme Builder → Conditions: `job` archive) | Dev | 2.5 hr | Phase 1 |
|  | — Hero section with title + subtitle | | | |
|  | — Category filter tabs (All, Annotation, Data Collection, etc.) | | | |
|  | — Sort dropdown (Newest, Oldest, A-Z, Z-A) | | | |
|  | — Posts Grid widget with job card design | | | |
|  | — Pagination (9 per page) | | | |
| 2.3 | **Job category archive pages** (`/jobs/type/{slug}`) | Dev | 30 min | 2.2 |
| 2.4 | **Pipeline validation** — Publish test job via centric-intake `wp_rest_client.py` | Dev | 30 min | 2.1, 2.2 |
| 2.5 | **Visual QA** — Compare 5 job listings against current site screenshots | QA | 1 hr | 2.1 |

**Exit criteria:** Job creation via REST API works. Single job page renders all fields including ACF repeater apply buttons. Archive shows all 46 jobs with working filters, sort, and pagination.

---

### Phase 3: Homepage (Day 3–4)

**Goal:** Rebuild the homepage with all its custom sections.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 3.1 | **Hero section** — H1, subtitle, dual CTAs (Get Started, View Jobs), hero illustration | Dev | 45 min | Phase 1 |
| 3.2 | **Stats counter section** — 1.8M Members, 300+ Languages, 222 Markets, 20K Projects with Counter widgets | Dev | 30 min | Phase 1 |
| 3.3 | **Job category grid** — 5 icon cards linking to job type archives | Dev | 30 min | Phase 1 |
| 3.4 | **Featured jobs carousel** — Elementor Carousel/Slider with dynamic job cards | Dev | 1 hr | Phase 2 |
| 3.5 | **5-step onboarding process** — Icon + text steps section | Dev | 30 min | Phase 1 |
| 3.6 | **Help CTA section** — Two-column with illustration | Dev | 15 min | Phase 1 |
| 3.7 | **Mobile responsive testing** | QA | 30 min | 3.1–3.6 |

**Exit criteria:** Homepage is pixel-comparable to current site on desktop and mobile. All links work. Counter animations function.

---

### Phase 4: Help Center (Day 4–5)

**Goal:** Rebuild the FAQ/help center system.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 4.1 | **Single FAQ template** (Theme Builder → Conditions: `faq` CPT) | Dev | 1 hr | Phase 1 |
| 4.2 | **FAQ Archive template** — Category sidebar/dropdown, article listing | Dev | 1.5 hr | Phase 1 |
| 4.3 | **FAQ Category archive pages** | Dev | 30 min | 4.2 |
| 4.4 | **Visual QA** — Compare help center against current site | QA | 30 min | 4.1–4.3 |

**Exit criteria:** All 55 FAQ articles render correctly. Category navigation works. Search functions.

---

### Phase 5: Content Pages (Day 5–6)

**Goal:** Rebuild all remaining static and marketing pages.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 5.1 | **How OneForma Works** — 5-step guide with illustrations | Dev | 1 hr | Phase 1 |
| 5.2 | **Domain Experts** — Multi-section landing page with embedded form | Dev | 1.5 hr | Phase 1 |
| 5.3 | **Blog archive template** | Dev | 45 min | Phase 1 |
| 5.4 | **Single blog post template** | Dev | 30 min | Phase 1 |
| 5.5 | **Contact Us** — Form with question-type dropdown + conditional logic | Dev | 1 hr | Phase 1 |
| 5.6 | **Landing Page Form (Domain Experts)** | Dev | 30 min | Phase 1 |
| 5.7 | **Legal pages** — Terms, Privacy Policy, GDPR, Cookie Policy, Code of Conduct | Dev | 1 hr | Phase 1 |
| 5.8 | **Fraud and Scam Awareness** | Dev | 30 min | Phase 1 |

**Exit criteria:** All 17+ pages rebuilt and rendering correctly.

---

### Phase 6: Forms Migration (Day 6)

**Goal:** Migrate or verify all forms.

| # | Task | Owner | Effort | Decision |
|---|---|---|---|---|
| 6.1 | **Decision: Keep CF7 or migrate to Elementor Forms** | Steven | — | See spec document for comparison |
| 6.2a | *If keeping CF7:* Verify CF7 + CF7 Conditional Fields work in Elementor via shortcode widget | Dev | 30 min | — |
| 6.2b | *If migrating:* Rebuild Contact Us form in Elementor Forms with conditional logic | Dev | 1.5 hr | — |
| 6.3 | **Verify hCaptcha integration** on all forms | Dev | 15 min | 6.2 |
| 6.4 | **Test form submissions** — Verify emails/notifications received | QA | 30 min | 6.2, 6.3 |

**Exit criteria:** All forms submit successfully with bot protection active.

---

### Phase 7: Analytics & Tracking Validation (Day 6–7)

**Goal:** Confirm all tracking fires correctly on the new theme.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 7.1 | Verify GTM container (`GTM-NR965959`) loads on all pages | Dev | 15 min | Phase 5 |
| 7.2 | Verify GA4 events fire: `page_view`, `of_touchpoint`, `opening_desk`, `AdToHomepageView` | Dev | 30 min | 7.1 |
| 7.3 | Verify Facebook Pixel (`925864871981853`) fires | Dev | 15 min | 7.1 |
| 7.4 | Verify LinkedIn Insight Tag (`7953745`) fires | Dev | 15 min | 7.1 |
| 7.5 | Verify Microsoft Clarity (`v65pc8ejaz`) records sessions | Dev | 15 min | 7.1 |
| 7.6 | Verify Cloudflare RUM beacon loads | Dev | 5 min | 7.1 |
| 7.7 | Verify custom cookies (`_of_vid`, `_of_sid`, `_of_dfp`) set correctly | Dev | 15 min | 7.1 |
| 7.8 | Verify hu-manity cookie consent banner displays and functions | Dev | 15 min | Phase 5 |

**Exit criteria:** All 5 tracking platforms confirmed active. Cookie consent functions. Custom cookies set.

---

### Phase 8: Performance Optimization (Day 7)

**Goal:** Mitigate Elementor's CSS/JS overhead.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 8.1 | Enable Elementor Experiments: Improved CSS Loading, Improved Asset Loading | Dev | 10 min | All phases |
| 8.2 | Enable Elementor → Settings → Performance → Generate CSS files, Load Minimum Fonts | Dev | 10 min | 8.1 |
| 8.3 | Purge unused Elementor widgets from loading (Element Manager) | Dev | 15 min | 8.1 |
| 8.4 | Run Google PageSpeed Insights — compare before/after scores | Dev | 30 min | 8.1–8.3 |
| 8.5 | Configure Cloudflare caching rules for Elementor CSS/JS assets | Dev | 15 min | 8.4 |
| 8.6 | Consider WP Rocket or LiteSpeed Cache if scores regress significantly | Dev | 1 hr | 8.4 (if needed) |

**Exit criteria:** PageSpeed scores within 10% of current site. No critical CWV regressions.

---

### Phase 9: Final QA & Go-Live (Day 7–8)

**Goal:** Comprehensive validation, then production switch.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 9.1 | **Full visual QA** — Every page compared against screenshots | QA | 2 hr | All phases |
| 9.2 | **Mobile QA** — All pages on iPhone, Android, iPad | QA | 1 hr | 9.1 |
| 9.3 | **Link audit** — Check for broken internal/external links | Dev | 30 min | 9.1 |
| 9.4 | **SEO validation** — Verify Yoast schema, OG tags, sitemaps, canonical URLs | Dev | 30 min | 9.1 |
| 9.5 | **End-to-end pipeline test** — Submit intake form → pipeline → WP job → verify on staging | Dev | 30 min | 9.1 |
| 9.6 | **Stakeholder review** — Steven + PM walkthrough on staging | Team | 1 hr | 9.1–9.5 |
| 9.7 | **Production backup** — Full DB + files backup immediately before switch | Dev | 15 min | 9.6 approved |
| 9.8 | **Activate Hello Elementor on production** | Dev | 5 min | 9.7 |
| 9.9 | **Import Elementor templates to production** (if not using staging → live push) | Dev | 30 min | 9.8 |
| 9.10 | **Post-launch smoke test** — Homepage, 3 job pages, help center, contact form, pipeline test | Dev | 30 min | 9.9 |
| 9.11 | **Monitor analytics** — Confirm real traffic data flowing for 24 hours | Dev | Passive | 9.10 |

**Exit criteria:** All pages live, all tracking active, pipeline tested, no 404s, no visual regressions.

---

## 7. Rollback Strategy

### Immediate Rollback (< 5 minutes)

If critical issues are found post-launch:

1. **Reactivate `oneforma2025` theme** via wp-admin → Appearance → Themes
2. The old theme remains installed and ready to reactivate
3. All content, ACF fields, and taxonomies are untouched (theme-independent)
4. The centric-intake pipeline continues working regardless of active theme

### Rollback Triggers

- Job pages return 404 or blank
- Pipeline-published jobs don't render correctly
- Analytics tracking completely stops
- Cookie consent banner missing (GDPR compliance risk)
- Widespread broken layouts on mobile

### Data Safety

| Data | Affected by Rollback? |
|---|---|
| Posts, pages, jobs, FAQs | No — stored in `wp_posts` table |
| ACF field values | No — stored in `wp_postmeta` table |
| Taxonomies | No — stored in `wp_terms` tables |
| Yoast SEO data | No — stored in `wp_postmeta` |
| Redirects | No — stored in Redirection plugin tables |
| Media uploads | No — stored in `/wp-content/uploads/` |
| Elementor templates | Remain installed but inactive when old theme is reactivated |

---

## 8. Validation & QA Protocol

### Page-by-Page Validation Checklist

For each page, verify:

- [ ] Content matches current site (text, images, links)
- [ ] Layout matches screenshot reference (desktop)
- [ ] Layout is responsive (mobile, tablet)
- [ ] All links work (internal and external)
- [ ] Meta title and description present (Yoast)
- [ ] OG image set
- [ ] Canonical URL correct
- [ ] No console errors (browser dev tools)
- [ ] Page loads in under 3 seconds

### Job-Specific Validation

- [ ] Job title renders from `post_title`
- [ ] Job content renders from `post_content` (HTML sections)
- [ ] Job Type badge renders from `job_type` taxonomy
- [ ] Location tag renders from `job_tag` taxonomy
- [ ] Compensation tag renders from `job_tag` taxonomy
- [ ] ACF `apply_job_title` renders
- [ ] ACF `apply_job_description` renders
- [ ] ACF `apply_job` repeater renders all language rows
- [ ] Each apply button links to correct `my.oneforma.com/crowd/jobs/{id}` URL
- [ ] Share buttons work (LinkedIn, X, Facebook)
- [ ] SEO excerpt set (Yoast meta description)

### Pipeline End-to-End Test

1. Create a test intake request in centric-intake dashboard
2. Worker picks up compute job
3. `wp_job_publisher.py` triggers
4. Job post created in WordPress (verify in wp-admin)
5. Job appears on `/jobs/` archive page
6. Single job page renders all fields correctly
7. ACF repeater shows apply buttons with correct URLs
8. Delete test job post after validation

---

## 9. Post-Migration Tasks

| # | Task | Timeline | Owner |
|---|---|---|---|
| 9.1 | Delete `oneforma2025` theme files (after 2-week observation period) | Day 22 | Dev |
| 9.2 | Remove Slick.js references from any remaining code | Day 8 | Dev |
| 9.3 | Remove old `template-domain-experts.php` and `template-form-only.php` references | Day 8 | Dev |
| 9.4 | Update `brand-design-system.md` memory file with Elementor-specific notes | Day 8 | Steven |
| 9.5 | Update this migration plan with actual completion dates and lessons learned | Day 8 | Steven |
| 9.6 | Train marketing team on Elementor page editing | Day 9–10 | Steven |
| 9.7 | Document Elementor template structure for future developers | Day 10 | Dev |
| 9.8 | Review PageSpeed scores after 1 week of production traffic | Day 15 | Dev |
| 9.9 | Review analytics data continuity (compare week-over-week) | Day 15 | Steven |

---

## 10. Timeline & Milestones

### Estimated Schedule

| Day | Phase | Milestone |
|---|---|---|
| **Day 1** | Phase 0: Foundation | Staging ready, plugins installed, ACF repeater solved |
| **Day 1–2** | Phase 1: Global Templates | Header + footer live on staging |
| **Day 2–3** | Phase 2: Job Templates | Job system fully functional (CRITICAL PATH) |
| **Day 3–4** | Phase 3: Homepage | Homepage rebuilt and responsive |
| **Day 4–5** | Phase 4: Help Center | FAQ system rebuilt |
| **Day 5–6** | Phase 5: Content Pages | All remaining pages rebuilt |
| **Day 6** | Phase 6: Forms | All forms working with bot protection |
| **Day 6–7** | Phase 7: Analytics | All tracking validated |
| **Day 7** | Phase 8: Performance | Speed optimized |
| **Day 7–8** | Phase 9: QA & Go-Live | Production switch |

**Total estimated duration:** 8 working days (15–20 hours of active build time)

### Milestones

| Milestone | Target | Blocker? |
|---|---|---|
| ACF Repeater solution tested | Day 1 | **Yes** — blocks Phase 2 |
| Job templates functional | Day 3 | **Yes** — blocks pipeline validation |
| Pipeline end-to-end test passes | Day 3 | **Yes** — blocks go-live |
| Stakeholder approval on staging | Day 7 | **Yes** — blocks go-live |
| Production go-live | Day 8 | — |

---

## 11. Dependencies & Blockers

### Software Dependencies

| Dependency | Required For | Status |
|---|---|---|
| Elementor Pro license | All phases | To acquire |
| ACF Pro (not free ACF) | Repeater fields + Elementor integration | Verify installed |
| Hello Elementor theme | Base theme | Free, install from WP repo |
| Staging environment | Safe development | To set up |

### Human Dependencies

| Person | Required For | Availability |
|---|---|---|
| Steven Junop | Design decisions, stakeholder review, final approval | Full-time |
| WordPress admin access | Plugin installation, theme activation | Available via `supabot` credentials |

### Blockers

| Blocker | Impact | Resolution |
|---|---|---|
| No staging environment | Cannot safely develop | Set up staging via hosting panel or WP Staging plugin |
| ACF is free version (not Pro) | Repeater fields won't work | Purchase ACF Pro ($49/yr) |
| No Elementor Pro license | Cannot use Theme Builder or Dynamic Tags | Purchase license ($59+/yr) |

---

## 12. Stakeholder Sign-Off

| Role | Name | Approval | Date |
|---|---|---|---|
| Digital Marketing Manager | Steven Junop | [ ] Approved | |
| VP of Product | TBD | [ ] Approved | |
| IT / WordPress Admin | TBD | [ ] Approved | |

---

*Plan created April 28, 2026. Updates will be tracked in this document as the migration progresses.*
