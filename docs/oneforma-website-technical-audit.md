# OneForma.com — Comprehensive Technical Audit

> **Audit Date:** April 28, 2026
> **Auditor:** Steven Junop (Digital Marketing Manager, Centific / OneForma)
> **Target:** https://www.oneforma.com/
> **Method:** Frontend crawl (Playwright browser), WordPress REST API enumeration, sitemap analysis, network traffic inspection, centric-intake backend tool review
> **Classification:** Internal — Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Platform](#2-core-platform)
3. [Custom Theme: oneforma2025](#3-custom-theme-oneforma2025)
4. [Custom Post Types & Taxonomies](#4-custom-post-types--taxonomies)
5. [WordPress Plugins](#5-wordpress-plugins)
6. [Analytics & Tracking Stack](#6-analytics--tracking-stack)
7. [Third-Party Integrations](#7-third-party-integrations)
8. [JavaScript Libraries & Frontend Dependencies](#8-javascript-libraries--frontend-dependencies)
9. [Full Page Inventory](#9-full-page-inventory)
10. [REST API Surface](#10-rest-api-surface)
11. [SEO & Structured Data](#11-seo--structured-data)
12. [Security & Compliance](#12-security--compliance)
13. [Backend Tooling (centric-intake)](#13-backend-tooling-centric-intake)
14. [Resource Loading Profile](#14-resource-loading-profile)
15. [Observations & Recommendations](#15-observations--recommendations)

---

## 1. Executive Summary

OneForma.com is a WordPress 6.9.4 site running a fully custom theme (`oneforma2025`) behind Cloudflare CDN/WAF. It serves as the public-facing recruitment platform for OneForma (a child brand of Centific), connecting AI domain experts with annotation, data collection, transcription, translation, and judging projects.

The site features:
- **46 active job listings** managed via a custom `job` post type with ACF repeater fields
- **55 help center articles** across 7 categories using a custom `faq` post type
- **Server-side Google Tag Manager** running on Google Cloud Run for first-party analytics
- **5 tracking platforms** (GA4 x2, Facebook Pixel, LinkedIn Insight Tag, Microsoft Clarity)
- **6 confirmed plugins** (Yoast SEO Premium, Contact Form 7, CF7 Conditional Fields, hCaptcha, Redirection, hu-manity cookie consent)
- **Separate member portal** at `my.oneforma.com` (ASP.NET application for login, applications, payments)

The `centric-intake` repository contains two backend WordPress clients (`wp_mcp_client.py` and `wp_rest_client.py`) that auto-publish job listings to the site as part of the AI-powered recruitment pipeline.

---

## 2. Core Platform

| Component | Detail |
|---|---|
| **CMS** | WordPress 6.9.4 |
| **Theme** | `oneforma2025` — fully custom, no parent theme |
| **CDN / Proxy** | Cloudflare (DNS, CDN, WAF, SSL, RUM) |
| **SEO** | Yoast SEO Premium v25.6 |
| **Analytics Server** | Server-Side GTM on Google Cloud Run |
| **SGTM Endpoint** | `oneforma-sgtm-911846343114.us-central1.run.app` |
| **GTM Container ID** | `GTM-NR965959` |
| **jQuery** | 3.7.1 (WordPress bundled) |
| **WP REST API** | `https://www.oneforma.com/wp-json/` |
| **Authentication** | Application Passwords enabled for REST API |

### Infrastructure Notes

- The origin server is fully masked behind Cloudflare; direct IP/hosting provider is not exposed.
- PHP version is not directly detectable but WordPress 6.9.4 requires PHP 7.4+ (likely 8.x).
- The site uses Cloudflare's managed SSL/TLS termination.

---

## 3. Custom Theme: `oneforma2025`

### 3.1 Build Pipeline

The theme uses a compiled asset pipeline (likely a Node.js build tool — Webpack, Vite, or Gulp):

| Asset | Path | Versioning |
|---|---|---|
| Compiled CSS | `/wp-content/themes/oneforma2025/assets/dist/css/styles.min.css` | `?ver=1746554235` (Unix timestamp) |
| Compiled JS | `/wp-content/themes/oneforma2025/assets/dist/js/scripts.min.js` | `?ver=1746554235` |
| Slider JS | `/wp-content/themes/oneforma2025/assets/js/slick/slick.js` | `?ver=1746554235` |
| Slider CSS | `/wp-content/themes/oneforma2025/assets/js/slick/slick-theme.min.css` | `?ver=1746554235` |

Build timestamp `1746554235` converts to **May 6, 2025** — indicating the last theme build date.

### 3.2 Self-Hosted Fonts

All Roboto font variants are self-hosted (no Google Fonts dependency):

```
/wp-content/themes/oneforma2025/assets/fonts/
├── Roboto-Regular.woff / .woff2
├── Roboto-Light.woff / .woff2
├── Roboto-Medium.woff / .woff2
├── Roboto-Bold.woff / .woff2
└── Roboto-Thin.woff / .woff2
```

**Total:** 10 font files (5 weights x 2 formats).

### 3.3 Custom SVG Icon Library

Theme-embedded icons at `/wp-content/themes/oneforma2025/assets/images/`:

| Icon | Filename | Usage |
|---|---|---|
| Annotation | `annotation-icon.svg` | Job category grid |
| Data Collection | `data-collection-icon.svg` | Job category grid |
| Judging | `judging-icon.svg` | Job category grid |
| Transcription | `transcription-icon.svg` | Job category grid |
| Translation | `translation-icon.svg` | Job category grid |
| Location | `location-icon.svg` | Job cards — location badge |
| Dollar | `dollar-icon.svg` | Job cards — compensation badge |
| Community | `community-icon.svg` | Onboarding steps |
| Certificate | `certificate-icon.svg` | Onboarding steps |
| Explore | `explore-icon.svg` | Onboarding steps |
| AI Chip | `ai-chip-icon.svg` | Onboarding steps |
| Earn | `earn-icon.svg` | Onboarding steps |

Additional static asset: `stats-bg-image.jpg` (background for statistics section).

### 3.4 Design System

| Token | Value | Notes |
|---|---|---|
| **Background** | `#FFFFFF` | Light theme — white backgrounds |
| **Text Primary** | `#000000` / `#1A1A1A` | Dark text |
| **Button Primary** | `#32373C` | Charcoal, pill-shaped (`border-radius: 9999px`) |
| **Button Text** | `#FFFFFF` | White on charcoal |
| **Error / Alert** | `#BF1722` | Red for error states |
| **Accent Gradient** | `linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))` | Cyan-blue to purple |
| **Muted Background** | `#F5F5F5` | Subtle section backgrounds |
| **Muted Text** | `#737373` | Secondary text |
| **Border** | `#E5E5E5` | Card and input borders |
| **Font Family** | Roboto (self-hosted) → system fallback stack | No Google Fonts CDN |
| **Card Shadow** | `6px 6px 9px rgba(0,0,0,0.2)` | Subtle natural shadow |
| **Card Radius** | ~12px | Rounded cards |
| **Button Radius** | `9999px` | Pill-shaped |
| **Input Radius** | ~10px | Rounded inputs |

### 3.5 Custom Template Components

#### Homepage Components
1. **Hero Section** — Full-width with H1, subtitle, dual CTAs ("Get Started" → register, "View Jobs" → /jobs), and illustrated hero image
2. **Stats Counter Bar** — Animated number counters: 1.8M Members, 300+ Languages, 222 Markets, 20K Projects. Background image with overlay
3. **Job Category Grid** — 5 icon cards (Annotation, Data Collection, Judging, Transcription, Translation) each linking to `/jobs/type/{slug}`
4. **Featured Jobs Carousel** — Slick.js slider with tabbed pagination. Shows job cards with category badge, title, location icon, compensation icon, description, and "Learn more" CTA
5. **5-Step Onboarding Process** — Vertical stepper with custom SVG icons: Join → Get Certified → Match → Contribute → Start Earning
6. **Help CTA Section** — Two-column layout with illustration and link to Help Center

#### Job Archive Template (`/jobs/`)
- Paginated grid layout (9 per page, 6 pages for 46 jobs)
- **Filter bar:** Category tabs (All, Translation, Data Collection, Transcription, Judging, Annotation, LLM Prompt Authoring)
- **Sort options:** Newest, Oldest, A-Z, Z-A
- **Job cards:** Category badge, title, location tag (with icon), compensation tag (with icon), excerpt, "Learn more" link

#### Single Job Template (`/jobs/{slug}/`)
- **Header:** Job title, category badge
- **Meta badges:** Location (icon + text), Compensation type (icon + text)
- **Content sections:** Description, Purpose, Main Requirements (bulleted), Preferred Qualifications (optional), Compensation Details, Project Details
- **Apply Job Repeater (ACF):** Per-language apply buttons linking to `my.oneforma.com/crowd/jobs/{id}` — allows multiple language variants per listing
- **Social sharing:** LinkedIn, Twitter/X, Facebook share buttons
- **Dual CTAs:** "Apply for this job" appears at top and bottom

#### Help Center Template (`/help-center/`)
- **Category sidebar** (desktop) / dropdown (mobile): General Inquiries, My Account and Profile, Troubleshooting, Online Safety and Cybersecurity, Project Help, Payment Issues and Finance, Certifications
- **FAQ listing:** Alphabetically sorted article titles linking to individual FAQ pages
- **Individual FAQ pages:** Full article content at `/help-center/{category}/{slug}/`

#### Domain Expert Landing Page (`/domain-expert/`)
- Multi-section marketing page with:
  - Hero with bullet points and CTA
  - "Why We Need Domain Experts" section
  - "How Experts Contribute" section
  - Compensation & Flexibility section
  - Qualification Criteria (4 checkmark items)
  - About OneForma section
  - Embedded Contact Form 7 modal/popup ("Connect With Us")

#### Blog Archive (`/blog/`)
- Post listing with featured image, date, title, excerpt, "Read More" link
- Currently only 3 published posts

#### Contact Form (`/contact-us-2/`)
- Contact Form 7 with conditional fields:
  - Name (text, required)
  - Email (email, required)
  - Question Type (dropdown): General Questions and Inquiries, Profile and Account Management, Payment and Finance Issues, Humus Project Support, Centaurus Project Support, Application Status, Certification Assistance, UHRS Project Support, Milky Way Project Support, Other Project Support
  - Message (textarea)
- hCaptcha bot protection

---

## 4. Custom Post Types & Taxonomies

### 4.1 Registered Post Types

| Post Type | Slug | REST Base | Has Archive | Hierarchical | Sitemapped | Count |
|---|---|---|---|---|---|---|
| **Posts** | `post` | `posts` | No | No | Yes | 3 |
| **Pages** | `page` | `pages` | No | Yes | Yes | 17 |
| **Jobs** | `job` | `job` | Yes | No | Yes | 46 |
| **FAQ** | `faq` | — | Unknown | No | Yes | 55 |
| **FAQ Pro** | `faq_pro` | — | Unknown | No | Yes (categories) | Unknown |
| **FAQ New** | `faq_new` | — | Unknown | No | Yes (categories) | Unknown |
| **Media** | `attachment` | `media` | No | No | No | — |
| **Nav Menu Items** | `nav_menu_item` | `menu-items` | No | No | No | — |
| **Patterns** | `wp_block` | `blocks` | No | No | No | — |
| **Templates** | `wp_template` | `templates` | No | No | No | — |
| **Template Parts** | `wp_template_part` | `template-parts` | No | No | No | — |
| **Global Styles** | `wp_global_styles` | `global-styles` | No | No | No | — |
| **Navigation** | `wp_navigation` | `navigation` | No | No | No | — |
| **Font Families** | `wp_font_family` | `font-families` | No | No | No | — |

### 4.2 Custom Taxonomies

| Taxonomy | Slug | Assigned To | Hierarchical | REST Base |
|---|---|---|---|---|
| **Categories** | `category` | `post` | Yes | `categories` |
| **Tags** | `post_tag` | `post` | No | `tags` |
| **Job Types** | `job_type` | `job` | No | `job_type` |
| **Job Tags** | `job_tag` | `job` | No | `job_tag` |
| **FAQ Categories** | `faq_category` | `faq` | Yes | `faq_category` |
| **FAQ Pro Categories** | `faq_pro_category` | `faq_pro` | Yes | `faq_pro_category` |
| **FAQ New Categories** | `faq_new_category` | `faq_new` | Yes | `faq_new_category` |
| **Nav Menus** | `nav_menu` | `nav_menu_item` | No | `menus` |
| **Pattern Categories** | `wp_pattern_category` | `wp_block` | No | `wp_pattern_category` |

### 4.3 Job Type Taxonomy Values

| Job Type | Used For |
|---|---|
| Annotation | AI data labeling, content evaluation, search trajectory annotation |
| Data Collection | Audio/video recording, family studies, image collection |
| Transcription | Audio-to-text transcription tasks |
| Translation | Human translation and MTPE (Machine Translation Post-Editing) |
| Judging | Internet judging, grading, evaluation tasks |
| LLM Prompt Authoring | Prompt writing and AI response evaluation |

### 4.4 Job Tag Taxonomy Values

**Compensation Tags:**
- Fixed Rate Per Hour
- Fixed Rate Per Approved Asset
- Fixed Rate Upon Completion
- Fixed Rate Per Source Word

**Location Tags:**
- Worldwide
- US
- UK
- Selected Locations
- (Individual country names when specific)

### 4.5 Custom Fields (ACF — Advanced Custom Fields)

The `job` CPT uses ACF fields for its apply section:

| Field Name | Type | Description |
|---|---|---|
| `apply_job_title` | Text | Display heading, e.g., "This role is available in 2 languages" |
| `apply_job_description` | Text | Instruction text, e.g., "Select the one most relevant to you." |
| `apply_job` | **Repeater** | Array of per-language apply rows |
| `apply_job.language` | Sub-field (Text) | Language name, e.g., "French - Switzerland" |
| `apply_job.apply_url` | Sub-field (URL) | Application link, e.g., `my.oneforma.com/crowd/jobs/12017` |

### 4.6 FAQ Categories

| Category | URL Path | Article Count |
|---|---|---|
| General Inquiries | `/help-center/general-inquiries/` | ~20 |
| My Account and Profile | `/help-center/my-account-and-profile/` | ~8 |
| Payment Issues and Finance | `/help-center/payment-issues-and-finance/` | ~5 |
| Project Help | `/help-center/project-help/` | ~12 |
| Certifications | `/help-center/certifications/` | ~2 |
| Troubleshooting | `/help-center/troubleshooting/` | Unknown |
| Online Safety and Cybersecurity | `/help-center/online-safety-and-cybersecurity/` | Unknown |

---

## 5. WordPress Plugins

### 5.1 Confirmed Active Plugins

#### Yoast SEO Premium v25.6
- **Purpose:** Full SEO management
- **Features detected:**
  - XML sitemaps (9 sitemaps in index)
  - Schema.org structured data (Organization, WebSite, BreadcrumbList, CollectionPage, SearchAction)
  - Open Graph and Twitter Card meta tags
  - Canonical URL management
  - AI content generator endpoints (`/yoast/v1/ai_generator/*`)
  - Semrush integration (`/yoast/v1/semrush/*`)
  - Wincher rank tracking (`/yoast/v1/wincher/*`)
  - Content analysis and prominent words (`/yoast/v1/prominent_words/*`)
  - Redirect management (`/yoast/v1/redirects`)
  - Link indexing and content indexing
  - SEO workouts
  - Robots meta: `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`

#### Contact Form 7 v6.0.6
- **Purpose:** Contact and lead capture forms
- **Assets loaded:**
  - `/wp-content/plugins/contact-form-7/includes/css/styles.css`
  - `/wp-content/plugins/contact-form-7/includes/swv/js/index.js` (Server-side validation)
  - `/wp-content/plugins/contact-form-7/includes/js/index.js` (Client-side form handling)
- **Global JS object:** `wpcf7` detected in runtime
- **REST endpoints:** `/contact-form-7/v1/contact-forms`, `/contact-form-7/v1/contact-forms/{id}/feedback`
- **Forms identified:**
  - Contact Us page (with question type dropdown)
  - Domain Expert landing page (connect form)
  - Landing page form (name, email, subject, message)

#### CF7 Conditional Fields v2.6.8
- **Purpose:** Show/hide form fields based on user selections
- **Assets loaded:**
  - `/wp-content/plugins/cf7-conditional-fields/style.css`
  - `/wp-content/plugins/cf7-conditional-fields/js/scripts.js`
- **Usage:** Conditional display of form fields based on "Question Type" dropdown selection on contact forms

#### hCaptcha for Forms and More
- **Purpose:** Bot protection / CAPTCHA on forms
- **Detection:**
  - Preconnect to `hcaptcha.com` in page `<head>`
  - Logo assets: `/wp-content/plugins/hcaptcha-for-forms-and-more/assets/images/hcaptcha-div-logo.svg`
  - White variant: `hcaptcha-div-logo-white.svg`
- **Integration:** Applied to Contact Form 7 forms

#### Redirection Plugin
- **Purpose:** URL redirect management and 404 error tracking
- **REST endpoints detected:**
  - `/redirection/v1/redirect` — CRUD for redirects
  - `/redirection/v1/group` — Redirect group management
  - `/redirection/v1/log` — Redirect hit logging
  - `/redirection/v1/404` — 404 error tracking and logging
  - `/redirection/v1/setting` — Plugin configuration
  - `/redirection/v1/import/file/{group_id}` — Import redirects from file
  - `/redirection/v1/export/{module}/{format}` — Export in CSV, Apache, Nginx, or JSON format

#### hu-manity.co Cookie Consent
- **Purpose:** GDPR/CCPA cookie consent management
- **Assets loaded from CDN:**
  - `cdn.hu-manity.co/hu-banner.min.js`
  - `cdn.hu-manity.co/hu-consent.min.js`
  - `cdn.hu-manity.co/hu-display.min.js`
- **Features:**
  - Three-tier consent model: Silver (essential only), Gold (analytics), Platinum (all tracking)
  - Duration selector: 1 month, 6 months, 12 months
  - "Do Not Sell" button (CCPA compliance)
  - "Customize" granular preferences
  - Privacy policy link
  - Renders as alert dialog overlay

### 5.2 Likely Active (via REST API)

#### CF7 Apps Connector
- **Namespace:** `cf7apps/v1`
- **Endpoints:** `/get-menu-items`, `/get-apps`, `/save-app-settings`, `/get-cf7-forms`, `/has-migrated`, `/migrate`
- **Purpose:** Connects Contact Form 7 to external apps/services (CRM, email marketing, webhooks)

### 5.3 WordPress Core Features Enabled

- Gutenberg Block Editor with block patterns
- Navigation Menus (REST-managed)
- Templates and Template Parts (Full Site Editing support)
- Global Styles
- Font Families manager
- Application Passwords (for REST API authentication)
- Batch API (up to 25 requests per batch)

---

## 6. Analytics & Tracking Stack

### 6.1 Google Analytics 4 (Server-Side)

OneForma uses **Server-Side Google Tag Manager** — an advanced setup where analytics data is processed through a first-party server before reaching Google, improving data quality and privacy compliance.

| Property | Measurement ID | Purpose |
|---|---|---|
| **Primary** | `G-QYQZLRHQFR` | Main OneForma site analytics |
| **Secondary** | `G-D36BJJJV7S` | Secondary property (likely Centific corporate or campaign-specific) |

| Configuration | Value |
|---|---|
| **GTM Container** | `GTM-NR965959` |
| **SGTM Endpoint** | `oneforma-sgtm-911846343114.us-central1.run.app` |
| **SGTM Platform** | Google Cloud Run (US Central 1) |
| **Transport** | HTTPS GET/POST to SGTM endpoint |

#### Custom GA4 Events

| Event Name | Description |
|---|---|
| `page_view` | Standard pageview (fires on load) |
| `user_engagement` | Standard engagement event |
| `of_touchpoint` | **Custom:** OneForma touchpoint tracking (pushed to dataLayer) |
| `opening_desk` | **Custom:** Page visibility / engagement tracking |
| `AdToHomepageView` | **Custom:** Tracks users arriving from ads who view the homepage |

#### DataLayer Events (in order)
1. `gtm.js` — GTM initialization
2. `config` — GA4 property configurations (x4)
3. `of_touchpoint` — Custom touchpoint event
4. `gtm.dom` — DOM ready
5. `gtm.load` — Page fully loaded

### 6.2 Facebook Pixel

| Setting | Value |
|---|---|
| **Pixel ID** | `925864871981853` |
| **SDK Version** | v2.9.308 (stable) |
| **Domain** | `www.oneforma.com` |
| **Event Modules** | 104+ modules loaded (comprehensive tracking) |
| **Global Function** | `fbq` |
| **Cookie** | `_fbp` |

### 6.3 LinkedIn Insight Tag

| Setting | Value |
|---|---|
| **Partner ID** | `7953745` |
| **Tracking Domain** | `px.ads.linkedin.com` |
| **Attribution** | Fires attribution triggers on page load |
| **Transport** | Pixel + fetch POST |

### 6.4 Microsoft Clarity

| Setting | Value |
|---|---|
| **Project ID** | `v65pc8ejaz` |
| **Script Version** | 0.8.60-beta |
| **Tag URL** | `www.clarity.ms/tag/v65pc8ejaz` |
| **Collection** | `a.clarity.ms/collect` |
| **Features** | Session recording, heatmaps, click tracking |
| **Cookies** | `_clck`, `_clsk` |

### 6.5 Cloudflare Web Analytics

| Setting | Value |
|---|---|
| **Beacon** | `static.cloudflareinsights.com/beacon.min.js` |
| **RUM Endpoint** | `/cdn-cgi/rum` |
| **Purpose** | Real User Monitoring (page load performance) |

### 6.6 Custom Cookies

| Cookie | Purpose | Origin |
|---|---|---|
| `_of_vid` | OneForma custom visitor ID | First-party (custom JS) |
| `_of_sid` | OneForma custom session ID | First-party (custom JS) |
| `_of_dfp` | OneForma device fingerprint | First-party (custom JS) |
| `_ga` | Google Analytics client ID | Google |
| `_ga_QYQZLRHQFR` | GA4 session (primary property) | Google |
| `_ga_D36BJJJV7S` | GA4 session (secondary property) | Google |
| `_fbp` | Facebook Pixel browser ID | Facebook |
| `_clck` | Microsoft Clarity user ID | Microsoft |
| `_clsk` | Microsoft Clarity session ID | Microsoft |

---

## 7. Third-Party Integrations

### 7.1 Member Portal

| Component | Detail |
|---|---|
| **URL** | `my.oneforma.com` |
| **Platform** | Separate application (likely ASP.NET based on `/Account/login` URL pattern) |
| **Login** | `my.oneforma.com/Account/login` |
| **Registration** | `my.oneforma.com/Account/register` |
| **Job Applications** | `my.oneforma.com/crowd/jobs/{id}` (per-locale application links) |
| **Features** | User profiles, skills/language management, project applications, certifications, payment setup, invoice management, KYC verification, MFA, weekly availability |

### 7.2 Payment Processors

| Provider | Usage |
|---|---|
| **Payoneer** | Primary freelancer payment method |
| **PayPal** | Alternative payment method |
| **Tipalti** | Enterprise payment automation platform |

### 7.3 Communication Integrations

| Service | Type | Usage |
|---|---|---|
| **Microsoft Teams** | Webhook | Adaptive card notifications for pipeline events (from centric-intake worker) |
| **Slack** | Webhook | Backup notification channel |
| **Outlook** | Email | Notification routes in centric-intake |

### 7.4 External Services

| Service | Type | Usage |
|---|---|---|
| **Cloudflare** | CDN / Security | DNS, CDN, SSL/TLS, WAF, Web Analytics RUM |
| **Google Cloud Run** | Analytics | Server-Side GTM container hosting |
| **hCaptcha** | Bot Protection | Form CAPTCHA on Contact Form 7 forms |
| **hu-manity.co** | Cookie Consent | GDPR/CCPA consent management (3 tiers) |
| **cdnjs.cloudflare.com** | CDN | Font Awesome 6.7.2 delivery |
| **Semrush** | SEO | Keyword data integrated via Yoast Premium |
| **Wincher** | SEO | Rank tracking integrated via Yoast Premium |

### 7.5 Social Media Presence

| Platform | Handle / URL |
|---|---|
| **LinkedIn** | [/company/oneformaglobal](https://www.linkedin.com/company/oneformaglobal) |
| **Instagram** | [@oneforma.global](https://www.instagram.com/oneforma.global/) |
| **Facebook** | [Profile](https://www.facebook.com/profile.php?id=61565741623189) |
| **Twitter/X** | [@OneForma_cm](https://twitter.com/OneForma_cm) |

---

## 8. JavaScript Libraries & Frontend Dependencies

### 8.1 External Scripts (loaded in browser)

| Library | Version | Source | Purpose |
|---|---|---|---|
| jQuery | 3.7.1 | WordPress core | DOM manipulation, plugin dependency |
| Slick.js | Bundled in theme | Theme assets | Homepage featured jobs carousel |
| wp-hooks | WP bundled | WordPress core | Hook/filter system for JS |
| wp-i18n | WP bundled | WordPress core | Internationalization |
| wp-emoji-release | WP 6.9.4 | WordPress core | Emoji support |
| Contact Form 7 JS | 6.0.6 | Plugin | Form AJAX submission and validation |
| CF7 SWV | 6.0.6 | Plugin | Server-side form validation |
| CF7 Conditional Fields | 2.6.8 | Plugin | Conditional field show/hide logic |
| Font Awesome | 6.7.2 | cdnjs CDN | Icon library |
| Clarity | 0.8.60-beta | clarity.ms | Session recording / heatmaps |
| Facebook Pixel | 2.9.308 | connect.facebook.net | Conversion tracking |
| LinkedIn Insight | Current | snap.licdn.com | B2B attribution |
| GTM | Current | googletagmanager.com | Tag management |
| Cloudflare Beacon | Current | cloudflareinsights.com | RUM |
| hu-manity Banner | Current | cdn.hu-manity.co | Cookie consent UI |
| hu-manity Consent | Current | cdn.hu-manity.co | Consent state management |
| hu-manity Display | Current | cdn.hu-manity.co | Consent display logic |

### 8.2 Global JS Objects Detected

| Object | Present | Notes |
|---|---|---|
| `jQuery` | Yes | v3.7.1 |
| `jQuery.fn.slick` | Yes | Slick carousel initialized |
| `wpcf7` | Yes | Contact Form 7 active |
| `wp` | Yes | WordPress core object |
| `wp.hooks` | Yes | WordPress hooks API |
| `clarity` | Yes | Microsoft Clarity |
| `dataLayer` | Yes | GTM dataLayer |
| `fbq` | Yes | Facebook Pixel |
| `hcaptcha` | No (lazy-loaded) | Loads only when form is visible |
| `gsap` | No | GreenSock not used |
| `Swiper` | No | Swiper not used |

### 8.3 CSS Dependencies

| Stylesheet | Source | Purpose |
|---|---|---|
| `styles.min.css` | Theme compiled | Primary site styles |
| `slick-theme.min.css` | Theme bundled | Slick carousel theme |
| `styles.css` | CF7 plugin | Form styling |
| `style.css` | CF7 Conditional Fields | Conditional field styles |
| `all.min.css` | Font Awesome 6.7.2 CDN | Icon styles |

**No CSS framework** (Bootstrap, Tailwind, Foundation, etc.) is used. All styling is fully custom CSS compiled into a single minified bundle.

---

## 9. Full Page Inventory

### 9.1 Main Pages (17)

| # | Page | URL | Last Modified | Template / Purpose |
|---|---|---|---|---|
| 1 | **Homepage** | `/` | 2025-12-08 | Hero, stats, categories, featured jobs, process, help CTA |
| 2 | **How OneForma Works** | `/how-oneforma-works/` | 2025-07-31 | 5-step onboarding guide |
| 3 | **Domain Experts** | `/domain-expert/` | 2026-02-06 | PhD/Masters recruitment landing page with embedded form |
| 4 | **Domain Experts (Alt)** | `/domain-experts/` | — | Alternate URL (footer link) |
| 5 | **Jobs** | `/jobs/` | — | Paginated job archive (46 listings) |
| 6 | **Blog** | `/blog/` | 2025-10-11 | Blog post archive |
| 7 | **Help Center** | `/help-center/` | 2025-04-03 | FAQ hub (55 articles, 7 categories) |
| 8 | **Contact Us** | `/contact-us-2/` | 2026-03-18 | CF7 form with question-type dropdown |
| 9 | **Contact Us (old)** | `/contact-us/` | 2025-08-05 | Original contact page |
| 10 | **Contact Us (v)** | `/contact-us-v/` | 2025-04-17 | Alternate contact version |
| 11 | **Contact Us (test)** | `/contact-us-new-test/` | 2026-04-20 | Testing/staging version |
| 12 | **Landing Page Form** | `/landing-page-form-domain-experts/` | 2026-02-03 | Lead capture form (name, email, subject, message) |
| 13 | **Form** | `/form/` | 2025-09-28 | Generic form page |
| 14 | **Terms and Conditions** | `/terms-and-conditions/` | 2025-06-11 | Legal |
| 15 | **Code of Conduct** | `/code-of-conduct/` | 2025-05-01 | Legal |
| 16 | **Privacy Policy** | `/privacy-policy/` | 2025-06-30 | Legal |
| 17 | **GDPR** | `/gdpr/` | 2025-10-11 | Legal |
| 18 | **Cookie Policy** | `/cookie-policy/` | 2026-03-03 | Legal |
| 19 | **Fraud and Scam Awareness** | `/fraud-and-scam-awareness/` | 2025-08-08 | Security / user education |

### 9.2 Job Listings (46)

<details>
<summary>Click to expand full job listing inventory</summary>

| # | Job Title | URL Slug |
|---|---|---|
| 1 | HTX Pilot | `htx-pilot` |
| 2 | QA Specialist for Squirrel TSE Data Collection | `qa-specialist-for-squirrel-tse-data-collection` |
| 3 | Dermatologist | `dermatologist` |
| 4 | Karl LLM French (Canada/France) | `karl-llm-french-canada-france` |
| 5 | APT Collection | `apt-collection` |
| 6 | HT Long Context Human Translation Project | `ht-long-context-human-translation-project` |
| 7 | Cherry Opal Grader Evaluator | `cherry-opal-grader-evaluator` |
| 8 | Education Pronunciation Evaluation | `education-pronunciation-evaluation` |
| 9 | Long Context Acceptability | `long-context-acceptability` |
| 10 | Internet Judging Lightspeed | `internet-judging-lightspeed` |
| 11 | Internet Judging Milky Way Maps Evaluation | `internet-judging-milky-way-maps-evaluation` |
| 12 | Vega Audio Collection QA | `vega-audio-collection-qa` |
| 13 | BGN Audio | `bgn-audio` |
| 14 | AVA Audio Collection | `ava-audio-collection` |
| 15 | Athena AI Agent Reviewer | `athena-ai-agent-reviewer` |
| 16 | Redwing User Experience Evaluation (Medical Domain) | `redwing-user-experience-evaluation-medical-domain` |
| 17 | Dr. Strange | `dr-strange` |
| 18 | Vega Transcription | `vega-transcription` |
| 19 | Board Certified Clinical Notes Specialist | `board-certified-clinical-notes-specialist` |
| 20 | Fred Annotation | `fred-annotation` |
| 21 | BGN Transcription | `bgn-transcription` |
| 22 | Diting Annotation | `diting-annotation` |
| 23 | Lighthouse 3 | `lighthouse-3` |
| 24 | Cosmos Voice Assistance Interaction Segmentation | `cosmos-voice-assistance-interaction-segmentation` |
| 25 | Adaptation | `adaptation` |
| 26 | Vega Audio Data Collection | `vega-audio-data-collection` |
| 27 | Cutis | `cutis` |
| 28 | UHRS Crowd Labeling Tasks | `uhrs-crowd-labeling-tasks` |
| 29 | Paragraph Level Acceptability | `paragraph-level-acceptability` |
| 30 | AdLoc | `adloc` |
| 31 | Amber Image Annotator Phase 2 | `amber-image-annotator-phase-2` |
| 32 | Apps and Music Grading | `apps-and-music-grading` |
| 33 | Lumina | `lumina` |
| 34 | Onyx OCR Annotation Finnish | `onyx-ocr-annotation-finnish` |
| 35 | Physicians | `physicians` |
| 36 | Humus 3 Kids | `humus-3-kids` |
| 37 | Humus 3 Adults | `humus-3-adults` |
| 38 | Sagittarius Task D | `sagittarius-task-d` |
| 39 | Fur Frame | `fur-frame` |
| 40 | Andromeda | `andromeda` |
| 41 | Project Mosaic Family Activity Recording | `project-mosaic-family-activity-recording` |
| 42 | Dola Multilingual Web Search Trajectory Annotation | `dola-multilingual-web-search-trajectory-annotation` |
| 43 | Centaurus | `centaurus` |
| 44 | Jellyfish Voice Assistant Conversation Annotation | `jellyfish-voice-assistant-conversation-annotation` |
| 45 | Acceptability and Preference Translation Raters | `acceptability-and-preference-translation-raters` |
| 46 | HT Human Translation and MTPE | `ht-human-translation-and-mtpe-machine-translation-post-editing` |

</details>

### 9.3 Help Center Articles (55)

<details>
<summary>Click to expand full help center article inventory</summary>

**General Inquiries (~20 articles)**
- How to Open a OneForma Account
- How to Get Started
- How to Set Up Your Profile
- How to Apply to Projects in Your Dashboard
- How to Review Tasks
- What to Expect When Working on Projects
- How to Apply for Humus Project Jobs on Mobile
- How to Apply for Sibling or Twin Data Collection Projects
- What is the Project Application Review Process?
- What is the Eligibility for Project Applications?
- How to Understand Project Approval Timelines
- I Want to Understand Job Availability and Location Restrictions
- I Have a UHRS-Specific Question
- I Haven't Received a Response from My Support Request
- How Does OneForma Ensure My Success?
- Why Domain Expertise is Critical in AI Training
- Protecting Your Account
- How to Contact OneForma Support
- Having Trouble Logging In?
- How to Set Up and Troubleshoot Multi-Factor Authentication (MFA)
- Identity Verification — What You Need to Know
- How to Complete Your KYC Verification
- Managing Your Weekly Availability
- I Need Help Understanding Payment Dates
- How to Set Up Payoneer Payment Method
- How to Set Up Tipalti Payment
- What Payment Methods are Available?
- Why Was My Registration Suspended?

**My Account and Profile (~8 articles)**
- How to Update Your Language Preferences
- How Do I Unlink a Payoneer Account?
- My Payoneer Account is Under Review
- I Want to Switch From Payoneer to PayPal
- How to Resolve Over-the-Phone (OTP) Verification Issues
- How to Set Up Your Payment Method
- How to Delete Your Account
- My Account Has Been Flagged for Suspicious Behavior

**Payment Issues and Finance (~5 articles)**
- What to Do if You Still Haven't Been Paid
- How to Troubleshoot Payment Issues
- How to Resolve Payment Disputes
- How Do I Understand and Submit the Correct Tax Form?
- How to Review and Approve Your Invoices (Non-legacy)

**Project Help (~12 articles)**
- I've Been Approved for a Project But No One Has Contacted Me
- I Have a Question About a Specific Project
- How to Troubleshoot Project Audio Issues
- What to Do if Your Application is Still Pending
- What if I Haven't Received Training on My Approved Project?
- How to Navigate Picture Submission Delays
- How to Understand Picture Rejection Due to Full Categories
- What to Do About Sudden Application Rejections
- MilkyWay Project FAQs
- GenAI Mastery
- I Can't Find Jobs I've Applied To
- Centaurus — Recording and Submitting Your Facial Videos

**Certifications (~2 articles)**
- How to Complete Certifications
- I Need to Request Additional Attempts for a Certification

</details>

### 9.4 Blog Posts (3)

| # | Title | URL | Published |
|---|---|---|---|
| 1 | Getting Started with OneForma | `/getting-started-with-oneforma/` | 2025-10-27 |
| 2 | Paid Research Studies in Seattle | `/paid-research-studies-in-seattle/` | 2025-10-27 |
| 3 | Is OneForma Legit? | `/is-oneforma-legit/` | 2025-10-27 |

---

## 10. REST API Surface

### 10.1 Namespace Summary

| Namespace | Plugin/Source | Key Endpoints |
|---|---|---|
| `wp/v2` | WordPress Core | Posts, pages, media, users, menus, blocks, templates, taxonomies |
| `yoast/v1` | Yoast SEO Premium | SEO stats, AI generator, indexing, redirects, Semrush, Wincher, workouts |
| `contact-form-7/v1` | Contact Form 7 | Form CRUD, feedback (submissions), refill |
| `cf7apps/v1` | CF7 Apps | App settings, menu items, form listing, migration |
| `redirection/v1` | Redirection | Redirect CRUD, groups, logs, 404s, import/export, settings |
| `oembed/1.0` | WordPress Core | Embed discovery (auto/proxy) |
| `wp-site-health/v1` | WordPress Core | Site health tests |
| `wp-block-editor/v1` | WordPress Core | Block editor search |
| `wp-abilities/v1` | WordPress Core | User capabilities |
| `batch/v1` | WordPress Core | Batch processing (up to 25 per request) |

### 10.2 Authentication

- **Method:** Application Passwords (Basic Auth)
- **Header:** `Authorization: Basic {base64(username:app_password)}`
- **Authorization endpoint:** `/wp-admin/authorize-application.php`
- **Configured user:** `supabot` (used by centric-intake worker)

### 10.3 Notable Yoast Premium Endpoints

| Endpoint | Purpose |
|---|---|
| `/yoast/v1/ai_generator/*` | AI-powered title/description generation |
| `/yoast/v1/semrush/keyphrases` | Semrush keyword data |
| `/yoast/v1/wincher/*` | Rank tracking data |
| `/yoast/v1/statistics` | SEO score statistics |
| `/yoast/v1/redirects` | Managed redirects |
| `/yoast/v1/indexing/*` | Content re-indexing |
| `/yoast/v1/prominent_words/*` | Internal linking suggestions |

---

## 11. SEO & Structured Data

### 11.1 Yoast SEO Configuration

| Feature | Status |
|---|---|
| **XML Sitemaps** | Enabled — 9 sitemaps in index |
| **Schema.org** | Full graph: Organization, WebSite, CollectionPage, BreadcrumbList, SearchAction |
| **Open Graph** | Enabled — og:locale, og:type, og:title, og:description, og:url, og:site_name |
| **Twitter Cards** | `summary_large_image` |
| **Canonical URLs** | Properly set on all pages |
| **Robots Meta** | `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` |
| **Breadcrumbs** | Schema markup present |
| **SearchAction** | Enabled (site search via `?s={query}`) |
| **Social Profiles** | Facebook linked in Organization schema |
| **Article Publisher** | Facebook profile linked |

### 11.2 Sitemap Index

| Sitemap | URL | Content |
|---|---|---|
| Post Sitemap | `/post-sitemap.xml` | 3 blog posts |
| Page Sitemap | `/page-sitemap.xml` | 17 pages |
| Job Sitemap | `/job-sitemap.xml` | 46 job listings |
| FAQ Sitemap | `/faq-sitemap.xml` | 55 FAQ articles |
| Category Sitemap | `/category-sitemap.xml` | Blog categories |
| FAQ Category Sitemap | `/faq_category-sitemap.xml` | 7 FAQ categories |
| FAQ Pro Category Sitemap | `/faq_pro_category-sitemap.xml` | FAQ Pro categories |
| FAQ New Category Sitemap | `/faq_new_category-sitemap.xml` | FAQ New categories |
| Author Sitemap | `/author-sitemap.xml` | Author archives |

### 11.3 robots.txt

```
# Blocked AI Crawlers
User-agent: Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot,
            CloudflareBrowserRenderingCrawler, Google-Extended, GPTBot, meta-externalagent
Disallow: /

# Content Policy
search=yes
ai-train=no

# Yoast Block
Disallow: /help-center-new/

# Sitemap
Sitemap: https://www.oneforma.com/sitemap_index.xml
```

---

## 12. Security & Compliance

### 12.1 Security Stack

| Layer | Technology | Status |
|---|---|---|
| **SSL/TLS** | Cloudflare-managed | Active (HTTPS enforced) |
| **CDN/WAF** | Cloudflare | Active |
| **Bot Protection** | hCaptcha | Active on CF7 forms |
| **Cookie Consent** | hu-manity.co | Active (GDPR/CCPA) |
| **AI Training Opt-Out** | robots.txt `ai-train=no` | Active |
| **Application Passwords** | WordPress native | Enabled for API auth |
| **MFA** | Available for user accounts | Via my.oneforma.com |
| **KYC Verification** | Identity verification | Via my.oneforma.com |

### 12.2 Compliance Pages

| Page | Purpose |
|---|---|
| `/terms-and-conditions/` | Terms of service |
| `/code-of-conduct/` | Contributor code of conduct |
| `/privacy-policy/` | Privacy policy |
| `/gdpr/` | GDPR compliance information |
| `/cookie-policy/` | Cookie usage policy |
| `/fraud-and-scam-awareness/` | Scam prevention education |

### 12.3 Cookie Consent Tiers

| Tier | Data Access Level | Description |
|---|---|---|
| **Silver** (default) | Essential only | Necessary operations, secure and functional. No 3rd-party analytics |
| **Gold** | Analytics | Adds analytics tracking (GA4, Clarity) |
| **Platinum** | Full | All tracking including Facebook Pixel, LinkedIn, advertising |

---

## 13. Backend Tooling (centric-intake)

The `centric-intake` repository at `/Users/stevenjunop/centric-intake/` contains Python-based backend tools that integrate with the WordPress site.

### 13.1 `wp_mcp_client.py` — WordPress MCP Client

- **Location:** `/worker/wp_mcp_client.py`
- **Purpose:** Auto-publish job posts via MCP protocol
- **Technology:** Spawns `@automattic/mcp-wordpress-remote` via stdio, manages async MCP session
- **Authentication:** Application Password via environment variables
- **Capabilities:** Create job posts with taxonomies and custom meta fields
- **Usage:** Async context manager (`async with WordPressMCPClient() as wp:`)

### 13.2 `wp_rest_client.py` — WordPress REST API Client

- **Location:** `/worker/wp_rest_client.py`
- **Purpose:** Direct REST API client (no MCP dependency, more reliable)
- **Technology:** `httpx` async HTTP client with Basic Auth
- **Capabilities:**
  - Create `job` CPT posts (falls back to regular posts if CPT not registered)
  - Set ACF custom fields (`acf` parameter for repeater fields)
  - Set standard WordPress meta fields
  - Set taxonomies (`job_type`, `job_tag`) — creates terms if they don't exist
  - Set post excerpts (used by Yoast as meta description)
  - Returns both live URL and preview URL for drafts
- **Usage:** Async context manager (`async with WordPressClient() as wp:`)

### 13.3 `wp_job_publisher.py` — Pipeline Job Publisher

- **Location:** `/worker/pipeline/wp_job_publisher.py`
- **Purpose:** Stage 0 of the AI recruitment pipeline — auto-publish job descriptions
- **Pipeline flow:**
  1. AI structures job description content via Qwen 3.5 (description, purpose, requirements, compensation, details sections)
  2. Maps task type to Job Type taxonomy (annotation → "Annotation", data_collection → "Data Collection", etc.)
  3. Maps compensation model to Job Tag (per_hour → "Fixed Rate Per Hour", etc.)
  4. Maps target regions to location tags (US, UK, Worldwide, etc.)
  5. Builds ACF `apply_job` repeater with per-language apply URLs from locale links
  6. Generates SEO excerpt (first sentence + languages/regions + "Apply now on OneForma")
  7. Publishes to WordPress via `wp_rest_client.py`
  8. Upserts `campaign_landing_pages.job_posting_url` in Neon database
  9. **Non-fatal:** If WordPress publish fails, the pipeline continues without it

### 13.4 WordPress Configuration

| Setting | Source | Value |
|---|---|---|
| `WP_SITE_URL` | Environment variable | `https://www.oneforma.com` |
| `WP_USERNAME` | Environment variable / wpaccess.json | `supabot` |
| `WP_APP_PASSWORD` | Environment variable / wpaccess.json | Application password |
| `WP_PUBLISH_STATUS` | Environment variable | `draft` (testing) or `publish` (production) |

---

## 14. Resource Loading Profile

### 14.1 Resource Count by Type

| Resource Type | Count |
|---|---|
| **JavaScript files** | 17 |
| **SVG images** | 13 |
| **Font files (woff + woff2)** | 11 |
| **CSS stylesheets** | 5 |
| **PNG images** | 4 |
| **JPG images** | 1 |
| **GIF images** | 1 |
| **Tracking pixels/beacons** | ~15 |
| **Total resources** | **72** |

### 14.2 External Domains Contacted

| Domain | Purpose |
|---|---|
| `www.oneforma.com` | Origin server |
| `cdn.hu-manity.co` | Cookie consent scripts |
| `cdnjs.cloudflare.com` | Font Awesome CDN |
| `static.cloudflareinsights.com` | Cloudflare Web Analytics |
| `www.googletagmanager.com` | Google Tag Manager |
| `oneforma-sgtm-*.us-central1.run.app` | Server-Side GTM (Cloud Run) |
| `connect.facebook.net` | Facebook Pixel SDK |
| `snap.licdn.com` | LinkedIn Insight Tag |
| `www.clarity.ms` / `a.clarity.ms` | Microsoft Clarity |
| `px.ads.linkedin.com` | LinkedIn attribution |
| `hcaptcha.com` | hCaptcha (preconnect, lazy-loaded) |

### 14.3 Preconnect / DNS Prefetch

```html
<link rel="preconnect" href="https://cdn.hu-manity.co/">
<link rel="preconnect" href="https://www.oneforma.com/">
<link rel="preconnect" href="https://cdnjs.cloudflare.com/">
<link rel="preconnect" href="https://hcaptcha.com/">
```

---

## 15. Observations & Recommendations

### 15.1 Architecture Observations

1. **Three FAQ Systems:** The site has three separate FAQ post types (`faq`, `faq_pro`, `faq_new`) with corresponding category taxonomies. This suggests iterative migration or reorganization of help center content. Consider consolidating into a single CPT.

2. **Multiple Contact Pages:** Four contact page variants exist (`/contact-us/`, `/contact-us-2/`, `/contact-us-v/`, `/contact-us-new-test/`). The footer links to `/contact-us-2/`. Old versions should be redirected or removed.

3. **Server-Side GTM:** The SGTM deployment on Cloud Run is an advanced, privacy-forward analytics setup. This provides first-party data collection, bypasses ad blockers, and improves data quality.

4. **Custom Visitor Tracking:** The `_of_vid`, `_of_sid`, and `_of_dfp` cookies indicate a custom visitor identification system beyond standard GA4, likely for cross-session attribution and device fingerprinting.

5. **Theme Build Date:** The asset version timestamp (`1746554235` = May 6, 2025) is nearly a year old. The theme build pipeline may not be frequently deployed.

6. **Minimal Blog:** Only 3 blog posts (all from October 2025) suggests content marketing is not yet a priority.

7. **ACF Dependency:** The job CPT relies on ACF repeater fields for per-language apply links — a critical dependency that should be documented for any theme migrations.

8. **No CSS Framework:** The entire frontend is custom CSS. This provides full design control but means every new component must be hand-styled.

### 15.2 Integration Points for centric-intake

The audit confirms the following integration touchpoints between the centric-intake pipeline and the WordPress site:

| Pipeline Stage | WordPress Integration |
|---|---|
| **Stage 0 (Job Publish)** | Creates `job` CPT post with taxonomy terms, ACF fields, SEO excerpt |
| **Job Types** | Maps `task_type` → `job_type` taxonomy |
| **Compensation** | Maps `compensation_model` → `job_tag` taxonomy |
| **Regions** | Maps `target_regions` → location job tags |
| **Apply Links** | Builds ACF `apply_job` repeater from `locale_links` |
| **SEO** | Auto-generates excerpt for Yoast meta description |
| **URL Tracking** | Stores live URL in `campaign_landing_pages` for UTM generation |

### 15.3 Noted Gaps

- **No aapanel API tool** was found in the centric-intake repository. If server-level management is needed (PHP version, MySQL, Nginx config, SSL certs), an aapanel integration would need to be built separately.
- **Help Center meta description** leaks internal instructions: `"THIS PAGE IS REQUIRED AND NEEDS TO HAVE THE TEMPLATE SET TO 'HELP CENTER'. THIS CONTENT WILL NOT BE RENDERED."` — this should be corrected in Yoast.
- **Yoast title for post type archive** shows `"OneForma |"` with a trailing pipe — the separator format should be cleaned up.
- **`/help-center-new/`** is blocked in robots.txt but doesn't appear in sitemaps — likely a staging/development page that should be confirmed as intentionally blocked.

---

## Appendix A: Sitemap URLs

**Sitemap Index:** `https://www.oneforma.com/sitemap_index.xml`

| Sitemap | URL |
|---|---|
| Posts | `https://www.oneforma.com/post-sitemap.xml` |
| Pages | `https://www.oneforma.com/page-sitemap.xml` |
| Jobs | `https://www.oneforma.com/job-sitemap.xml` |
| FAQs | `https://www.oneforma.com/faq-sitemap.xml` |
| Categories | `https://www.oneforma.com/category-sitemap.xml` |
| FAQ Categories | `https://www.oneforma.com/faq_category-sitemap.xml` |
| FAQ Pro Categories | `https://www.oneforma.com/faq_pro_category-sitemap.xml` |
| FAQ New Categories | `https://www.oneforma.com/faq_new_category-sitemap.xml` |
| Authors | `https://www.oneforma.com/author-sitemap.xml` |

---

## Appendix B: Complete Script Inventory

```
# WordPress Core
/wp-includes/js/jquery/jquery.min.js?ver=3.7.1
/wp-includes/js/wp-emoji-release.min.js?ver=6.9.4
/wp-includes/js/dist/hooks.min.js
/wp-includes/js/dist/i18n.min.js

# Theme
/wp-content/themes/oneforma2025/assets/dist/js/scripts.min.js
/wp-content/themes/oneforma2025/assets/js/slick/slick.js

# Plugins
/wp-content/plugins/contact-form-7/includes/swv/js/index.js?ver=6.0.6
/wp-content/plugins/contact-form-7/includes/js/index.js?ver=6.0.6
/wp-content/plugins/cf7-conditional-fields/js/scripts.js?ver=2.6.8

# Analytics & Tracking
https://www.googletagmanager.com/gtm.js?id=GTM-NR965959
https://www.googletagmanager.com/gtag/js?id=G-QYQZLRHQFR
https://www.googletagmanager.com/gtag/js?id=G-D36BJJJV7S
https://connect.facebook.net/en_US/fbevents.js
https://connect.facebook.net/signals/config/925864871981853
https://snap.licdn.com/li.lms-analytics/insight.min.js
https://scripts.clarity.ms/0.8.60-beta/clarity.js
https://www.clarity.ms/tag/v65pc8ejaz
https://static.cloudflareinsights.com/beacon.min.js

# Cookie Consent
https://cdn.hu-manity.co/hu-banner.min.js
https://cdn.hu-manity.co/hu-consent.min.js
https://cdn.hu-manity.co/hu-display.min.js
```

---

## Appendix C: Complete Stylesheet Inventory

```
# Plugins
/wp-content/plugins/contact-form-7/includes/css/styles.css?ver=6.0.6
/wp-content/plugins/cf7-conditional-fields/style.css?ver=2.6.8

# Theme
/wp-content/themes/oneforma2025/assets/dist/css/styles.min.css?ver=1746554235
/wp-content/themes/oneforma2025/assets/js/slick/slick-theme.min.css?ver=1746554235

# CDN
https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css
```

---

*Document generated April 28, 2026. All data reflects the live state of oneforma.com at time of audit.*
