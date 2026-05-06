# OneForma.com — Elementor Pro Migration Technical Specification

> **Created:** April 28, 2026
> **Author:** Steven Junop (Digital Marketing Manager, Centific / OneForma)
> **Companion:** `docs/oneforma-elementor-migration-plan.md` (phased plan)
> **Reference:** `docs/oneforma-website-technical-audit.md` (current state audit)
> **Status:** Draft
> **Classification:** Internal — Confidential

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Decisions](#2-technology-decisions)
3. [Design Token Mapping](#3-design-token-mapping)
4. [Elementor Global Settings Spec](#4-elementor-global-settings-spec)
5. [Theme Builder Template Specifications](#5-theme-builder-template-specifications)
6. [ACF Field Mapping & Repeater Solution](#6-acf-field-mapping--repeater-solution)
7. [Custom Post Type Template Specs](#7-custom-post-type-template-specs)
8. [Page Specifications](#8-page-specifications)
9. [Forms Specification](#9-forms-specification)
10. [Navigation & Menu Spec](#10-navigation--menu-spec)
11. [Analytics Integration Spec](#11-analytics-integration-spec)
12. [Performance Budget](#12-performance-budget)
13. [SEO Continuity Spec](#13-seo-continuity-spec)
14. [Pipeline Integration Validation](#14-pipeline-integration-validation)
15. [Plugin Manifest](#15-plugin-manifest)
16. [File & Asset Manifest](#16-file--asset-manifest)

---

## 1. Architecture Overview

### Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare CDN / WAF / SSL                             │
├─────────────────────────────────────────────────────────┤
│  WordPress 6.9.4                                        │
│  ├── Theme: oneforma2025 (custom PHP templates)         │
│  ├── ACF Pro (field definitions)                        │
│  ├── Yoast SEO Premium                                  │
│  ├── Contact Form 7 + Conditional Fields                │
│  ├── hCaptcha                                           │
│  ├── Redirection                                        │
│  └── hu-manity cookie consent                           │
├─────────────────────────────────────────────────────────┤
│  Custom CSS (styles.min.css) + Slick.js + jQuery        │
├─────────────────────────────────────────────────────────┤
│  SGTM (Cloud Run) → GA4 x2 + FB + LI + Clarity         │
└─────────────────────────────────────────────────────────┘
          ↑ REST API (POST /wp-json/wp/v2/job)
          │
┌─────────┴─────────────────────────────────────────────┐
│  centric-intake worker (wp_rest_client.py)             │
│  → wp_job_publisher.py → publishes jobs automatically  │
└───────────────────────────────────────────────────────┘
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare CDN / WAF / SSL  (unchanged)                │
├─────────────────────────────────────────────────────────┤
│  WordPress 6.9.4                                        │
│  ├── Theme: Hello Elementor (minimal base)              │  ← CHANGED
│  ├── Elementor Pro (Theme Builder, Dynamic Tags, Forms) │  ← NEW
│  ├── ACF Pro (field definitions — unchanged)            │
│  ├── Yoast SEO Premium (unchanged)                      │
│  ├── hCaptcha (unchanged)                               │
│  ├── Redirection (unchanged)                            │
│  ├── hu-manity cookie consent (unchanged)               │
│  └── Site-Specific Plugin: OneForma Helpers             │  ← NEW (shortcodes/widgets)
├─────────────────────────────────────────────────────────┤
│  Elementor-generated CSS/JS + Font Awesome (built-in)   │  ← CHANGED
├─────────────────────────────────────────────────────────┤
│  SGTM (Cloud Run) → GA4 x2 + FB + LI + Clarity         │  (unchanged)
└─────────────────────────────────────────────────────────┘
          ↑ REST API (POST /wp-json/wp/v2/job)  (unchanged)
          │
┌─────────┴─────────────────────────────────────────────┐
│  centric-intake worker (wp_rest_client.py)  (unchanged)│
│  → wp_job_publisher.py  (unchanged)                    │
└───────────────────────────────────────────────────────┘
```

**Key change:** The rendering layer switches from custom PHP templates to Elementor Theme Builder templates. Everything below the template layer (data, API, plugins, analytics) remains identical.

---

## 2. Technology Decisions

### Decision Log

| # | Decision | Choice | Rationale | Alternatives Considered |
|---|---|---|---|---|
| D1 | Base theme | Hello Elementor | Official Elementor theme, minimal footprint, actively maintained, zero conflicts | Astra (bloated for this use case), GeneratePress (unnecessary features) |
| D2 | Page builder | Elementor Pro | Theme Builder for CPT templates, Dynamic Tags for ACF, best visual builder ecosystem | Bricks Builder (smaller community), Oxygen (steeper learning curve) |
| D3 | ACF Repeater rendering | Custom shortcode `[job_apply_buttons]` in site-specific plugin | Zero external dependencies, 30 lines of code, fully controlled, easy to style | Dynamic.ooo ($69/yr recurring cost), Elementor Loop Grid (complex setup for simple repeater) |
| D4 | Form solution | **Keep Contact Form 7** (Phase 1) — evaluate Elementor Forms later | CF7 works, conditional logic already configured, zero effort to retain via shortcode widget | Elementor Forms (would require rebuilding conditional logic from scratch) |
| D5 | Font loading | Self-host Roboto via Hello Elementor Custom Fonts | Matches current site, no Google Fonts CDN dependency, GDPR-safe | Google Fonts CDN (GDPR risk in EU), system fonts only (visual change) |
| D6 | Icon library | Elementor built-in (Font Awesome 6) + uploaded custom SVGs | FA already used on current site, custom SVGs uploaded to media library | Icon library plugin (unnecessary), inline SVGs in templates (maintenance burden) |
| D7 | Caching | Elementor CSS File Generation + Cloudflare | Cloudflare already handles CDN; Elementor generates static CSS files | WP Rocket (evaluate post-launch if needed) |
| D8 | Job archive filtering | Elementor Posts widget with taxonomy query + custom taxonomy filter tabs | Native Elementor, no additional plugins | JetSmartFilters (overkill), custom JS (maintenance burden) |

---

## 3. Design Token Mapping

All design tokens from the current `oneforma2025` theme mapped to Elementor Global Settings:

### Colors

| Token Name | Hex Value | Elementor Global Color Name | Usage |
|---|---|---|---|
| Background | `#FFFFFF` | `of-background` | Page backgrounds |
| Text Primary | `#1A1A1A` | `of-text-primary` | Headings, body text |
| Text Secondary | `#737373` | `of-text-secondary` | Muted text, captions |
| Button Primary | `#32373C` | `of-charcoal` | Primary buttons, dark UI |
| Button Text | `#FFFFFF` | `of-white` | Text on dark buttons |
| Surface Muted | `#F5F5F5` | `of-surface-muted` | Section backgrounds |
| Border | `#E5E5E5` | `of-border` | Card borders, dividers |
| Error | `#BF1722` | `of-error` | Error states, alerts |
| Gradient Start | `rgb(6,147,227)` | `of-gradient-start` | Accent gradient — cyan-blue |
| Gradient End | `rgb(155,81,224)` | `of-gradient-end` | Accent gradient — purple |

### Typography

| Element | Font | Size | Weight | Line Height | Elementor Global Font Name |
|---|---|---|---|---|---|
| H1 | Roboto | 42px | 700 (Bold) | 1.2 | `of-heading-1` |
| H2 | Roboto | 36px | 700 (Bold) | 1.25 | `of-heading-2` |
| H3 | Roboto | 24px | 500 (Medium) | 1.3 | `of-heading-3` |
| Body | Roboto | 16px | 400 (Regular) | 1.6 | `of-body` |
| Small | Roboto | 13px | 400 (Regular) | 1.5 | `of-small` |
| Button | Roboto | 18px (1.125em) | 500 (Medium) | 1.4 | `of-button` |

### Spacing Scale

| Token | Value | Elementor Usage |
|---|---|---|
| `xs` | 0.44rem (7px) | Tight padding |
| `sm` | 0.67rem (11px) | Badge padding |
| `md` | 1rem (16px) | Default gap |
| `lg` | 1.5rem (24px) | Section padding |
| `xl` | 2.25rem (36px) | Large section gaps |
| `2xl` | 3.38rem (54px) | Hero section padding |
| `3xl` | 5.06rem (81px) | Full-width section vertical spacing |

### Component Styles

| Component | Border Radius | Shadow | Padding |
|---|---|---|---|
| Button (primary) | `9999px` (pill) | None | `calc(.667em + 2px) calc(1.333em + 2px)` |
| Button (secondary) | `9999px` (pill) | None | Same as primary, border: 1px solid `#32373C` |
| Card | `12px` | `0 2px 8px rgba(0,0,0,0.08)` | `24px` |
| Input | `10px` | None | `12px 16px` |
| Badge | `9999px` (pill) | None | `4px 12px` |

---

## 4. Elementor Global Settings Spec

### Settings → General

```
Content Width:              1200px
Widgets Space:              20px
Stretched Section Fit To:   Full Width
Page Title Selector:        h1.entry-title  (hidden — Elementor controls titles)
```

### Settings → Style → Theme Style

```
Background Color:           #FFFFFF
Body Typography:            Roboto, 16px, 400, line-height 1.6
Link Color:                 #32373C
Link Hover Color:           #0693E3 (gradient start — cyan)
```

### Settings → Style → Buttons

```
Typography:                 Roboto, 18px, 500
Text Color:                 #FFFFFF
Background Color:           #32373C
Border Radius:              50px 50px 50px 50px  (pill)
Padding:                    12px 24px 12px 24px
Hover Background:           #1A1A1A
Hover Text Color:           #FFFFFF
```

### Settings → Style → Form Fields

```
Typography:                 Roboto, 16px, 400
Text Color:                 #1A1A1A
Background Color:           #FFFFFF
Border Type:                Solid
Border Width:               1px
Border Color:               #E5E5E5
Border Radius:              10px
Padding:                    12px 16px
Focus Border Color:         #0693E3
```

### Settings → Lightbox

```
Disable:                    Yes (not used on the site)
```

### Settings → Performance

```
CSS Print Method:           External File
Improved Asset Loading:     Active (Experiment)
Improved CSS Loading:       Active (Experiment)
Lazy Load Background Images: Active
Element Manager:            Disable unused widgets
```

### Custom Fonts (Hello Elementor → Appearance → Custom Fonts)

Upload all Roboto variants from current theme:

| Font Name | Weight | Style | woff2 File | woff File |
|---|---|---|---|---|
| Roboto | 100 | Normal | `Roboto-Thin.woff2` | `Roboto-Thin.woff` |
| Roboto | 300 | Normal | `Roboto-Light.woff2` | `Roboto-Light.woff` |
| Roboto | 400 | Normal | `Roboto-Regular.woff2` | `Roboto-Regular.woff` |
| Roboto | 500 | Normal | `Roboto-Medium.woff2` | `Roboto-Medium.woff` |
| Roboto | 700 | Normal | `Roboto-Bold.woff2` | `Roboto-Bold.woff` |

---

## 5. Theme Builder Template Specifications

### Template Inventory

| Template | Type | Condition | Priority |
|---|---|---|---|
| Header | Header | Entire Site | Global |
| Footer | Footer | Entire Site | Global |
| Single Job | Single | Post Type = `job` | CPT-specific |
| Job Archive | Archive | Post Type Archive = `job` | CPT-specific |
| Job Type Archive | Archive | Taxonomy Archive = `job_type` | Taxonomy-specific |
| Single FAQ | Single | Post Type = `faq` | CPT-specific |
| FAQ Archive | Archive | Post Type Archive = `faq` | CPT-specific |
| FAQ Category Archive | Archive | Taxonomy Archive = `faq_category` | Taxonomy-specific |
| Single Blog Post | Single | Post Type = `post` | Default |
| Blog Archive | Archive | Post Type Archive = `post` | Default |
| 404 | Single | 404 Page | Error |
| Search Results | Archive | Search Results | Search |

### Template Display Conditions

```
Header              → Include: Entire Site
Footer              → Include: Entire Site
Single Job          → Include: All Singular / Jobs
Job Archive         → Include: All Archives / Jobs
Job Type Archive    → Include: All Archives / Job Types
Single FAQ          → Include: All Singular / FAQs
FAQ Archive         → Include: All Archives / FAQs
FAQ Category Archive→ Include: All Archives / FAQ Categories
Single Blog Post    → Include: All Singular / Posts
Blog Archive        → Include: All Archives / Posts
404                 → Include: 404 Page
Search              → Include: Search Results
```

---

## 6. ACF Field Mapping & Repeater Solution

### 6.1 Existing ACF Field Definitions (Unchanged)

These field definitions are stored in the database and are **not affected** by the theme change:

#### Field Group: "Job Apply Section"

| Field Name | Field Type | Required | Instructions |
|---|---|---|---|
| `apply_job_title` | Text | No | Heading text for apply section |
| `apply_job_description` | Text | No | Subtitle/instruction text |
| `apply_job` | Repeater | No | Per-language apply button rows |
| `apply_job` → `language` | Text (sub-field) | Yes | Language name (e.g., "French - Switzerland") |
| `apply_job` → `apply_url` | URL (sub-field) | Yes | Application link (e.g., my.oneforma.com/crowd/jobs/12017) |

**Location Rule:** Post Type = `job`

### 6.2 Elementor Dynamic Tag Mapping

For simple ACF fields, Elementor Pro Dynamic Tags read them directly:

| ACF Field | Elementor Widget | Dynamic Tag |
|---|---|---|
| `apply_job_title` | Heading widget | ACF Field → `apply_job_title` |
| `apply_job_description` | Text Editor widget | ACF Field → `apply_job_description` |
| `apply_job` (repeater) | **Shortcode widget** | `[job_apply_buttons]` |

### 6.3 ACF Repeater Solution: Custom Shortcode

**File:** `wp-content/mu-plugins/oneforma-helpers.php` (must-use plugin — auto-loaded, cannot be deactivated)

```php
<?php
/**
 * Plugin Name: OneForma Helpers
 * Description: Shortcodes and widgets for OneForma Elementor templates.
 * Version: 1.0.0
 * Author: Steven Junop
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * [job_apply_buttons] — Renders the ACF apply_job repeater field.
 *
 * Usage: Place in Elementor Shortcode widget inside Single Job template.
 *
 * Attributes:
 *   class  — Additional CSS class for the wrapper (default: "of-apply-section")
 *
 * Output:
 *   <div class="of-apply-section">
 *     <h3>{apply_job_title}</h3>
 *     <p>{apply_job_description}</p>
 *     <div class="of-apply-buttons">
 *       <a href="{apply_url}" class="of-apply-btn" target="_blank" rel="noopener">
 *         Apply in {language}
 *       </a>
 *       ...
 *     </div>
 *   </div>
 */
add_shortcode( 'job_apply_buttons', function( $atts ) {
    $atts = shortcode_atts( [ 'class' => 'of-apply-section' ], $atts );

    if ( ! function_exists( 'have_rows' ) || ! have_rows( 'apply_job' ) ) {
        return '';
    }

    $title = esc_html( get_field( 'apply_job_title' ) );
    $desc  = esc_html( get_field( 'apply_job_description' ) );

    $html = '<div class="' . esc_attr( $atts['class'] ) . '">';

    if ( $title ) {
        $html .= '<h3 class="of-apply-title">' . $title . '</h3>';
    }
    if ( $desc ) {
        $html .= '<p class="of-apply-desc">' . $desc . '</p>';
    }

    $html .= '<div class="of-apply-buttons">';

    while ( have_rows( 'apply_job' ) ) {
        the_row();
        $url  = esc_url( get_sub_field( 'apply_url' ) );
        $lang = esc_html( get_sub_field( 'language' ) );

        if ( $url && $lang ) {
            $html .= sprintf(
                '<a href="%s" class="of-apply-btn" target="_blank" rel="noopener">Apply in %s</a>',
                $url,
                $lang
            );
        }
    }

    $html .= '</div></div>';
    return $html;
} );

/**
 * [job_meta_badges] — Renders location + compensation badges from job_tag taxonomy.
 *
 * Usage: Place in Elementor Shortcode widget inside Single Job template.
 *
 * Reads the job_tag taxonomy terms and renders them with appropriate icons.
 */
add_shortcode( 'job_meta_badges', function() {
    $post_id = get_the_ID();
    if ( ! $post_id ) return '';

    $tags = get_the_terms( $post_id, 'job_tag' );
    if ( ! $tags || is_wp_error( $tags ) ) return '';

    $compensation_keywords = [
        'Fixed Rate Per Hour',
        'Fixed Rate Per Approved Asset',
        'Fixed Rate Upon Completion',
        'Fixed Rate Per Source Word',
    ];

    $html = '<div class="of-meta-badges">';

    foreach ( $tags as $tag ) {
        $name = esc_html( $tag->name );
        $is_compensation = in_array( $tag->name, $compensation_keywords, true );
        $icon_class = $is_compensation ? 'fa-solid fa-dollar-sign' : 'fa-solid fa-location-dot';
        $badge_class = $is_compensation ? 'of-badge of-badge-compensation' : 'of-badge of-badge-location';

        $html .= sprintf(
            '<span class="%s"><i class="%s"></i> %s</span>',
            $badge_class,
            $icon_class,
            $name
        );
    }

    $html .= '</div>';
    return $html;
} );

/**
 * [job_type_badge] — Renders the job_type taxonomy as a category badge.
 */
add_shortcode( 'job_type_badge', function() {
    $post_id = get_the_ID();
    if ( ! $post_id ) return '';

    $types = get_the_terms( $post_id, 'job_type' );
    if ( ! $types || is_wp_error( $types ) ) return '';

    $type = $types[0];
    return sprintf(
        '<span class="of-badge of-badge-category">%s</span>',
        esc_html( $type->name )
    );
} );
```

### 6.4 CSS for Shortcode Output

Add to Elementor → Custom CSS (Site Settings) or the `mu-plugin`:

```css
/* Apply Section */
.of-apply-section {
    margin-top: 2.25rem;
    padding: 1.5rem;
    background: #F5F5F5;
    border-radius: 12px;
}

.of-apply-title {
    font-size: 1.25rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: #1A1A1A;
}

.of-apply-desc {
    font-size: 0.875rem;
    color: #737373;
    margin-bottom: 1rem;
}

.of-apply-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.of-apply-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.667em 1.333em;
    background: #32373C;
    color: #FFFFFF !important;
    border-radius: 9999px;
    font-size: 1rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.2s;
}

.of-apply-btn:hover {
    background: #1A1A1A;
    color: #FFFFFF !important;
}

/* Meta Badges */
.of-meta-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1rem 0;
}

.of-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
}

.of-badge-category {
    background: linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224));
    color: #FFFFFF;
}

.of-badge-location {
    background: #F5F5F5;
    color: #1A1A1A;
}

.of-badge-compensation {
    background: #F5F5F5;
    color: #1A1A1A;
}

.of-badge i {
    font-size: 0.75rem;
}
```

---

## 7. Custom Post Type Template Specs

### 7.1 Single Job Template

**Template Name:** `single-job`
**Condition:** All Singular → Jobs
**Layout:** Single Column, 800px max-width, centered

```
┌─────────────────────────────────────────────────────┐
│ [SECTION: Hero — Padding 3xl top, xl bottom]        │
│                                                     │
│   [Shortcode: job_type_badge]                       │
│   [Heading: Dynamic Tag → Post Title] — H1          │
│   [Shortcode: job_meta_badges]                      │
│                                                     │
│   [Button: "Apply for this job"]                    │
│    → Link: Dynamic Tag → ACF apply_job[0].apply_url │
│    → OR anchor link to #apply-section               │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: Content — Padding xl]                     │
│                                                     │
│   [Text Editor: Dynamic Tag → Post Content]         │
│    ← This renders the HTML sections:                │
│      Description, Purpose, Requirements,            │
│      Preferred, Compensation, Details               │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: Apply — id="apply-section" Padding xl]    │
│                                                     │
│   [Shortcode: job_apply_buttons]                    │
│    ← Renders ACF repeater with per-language buttons │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: Share — Padding lg]                       │
│                                                     │
│   [Share Buttons: LinkedIn, Twitter/X, Facebook]    │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: Related Jobs — Padding xl] (optional)     │
│                                                     │
│   [Posts widget: 3 jobs, same job_type, grid]       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2 Job Archive Template

**Template Name:** `archive-job`
**Condition:** All Archives → Jobs
**Layout:** Full Width, 1200px container

```
┌─────────────────────────────────────────────────────┐
│ [SECTION: Hero — Padding 2xl]                       │
│                                                     │
│   [Heading: "Jobs"] — H1                            │
│   [Text: "Use your expertise to drive the future    │
│    of AI innovation."]                              │
│   [Text: "Join the OneForma community today."]      │
│   [Text: "Showing X of Y jobs"]                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: Filters — Padding md, sticky optional]    │
│                                                     │
│   [Tabs/Buttons: All | Translation | Data           │
│    Collection | Transcription | Judging |            │
│    Annotation | LLM Prompt Authoring]               │
│    → Each links to /jobs/type/{slug}/ OR filters    │
│      via Elementor taxonomy query                   │
│                                                     │
│   [Dropdown: Sort by — Newest | Oldest | A-Z | Z-A] │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: Job Grid — Padding xl]                    │
│                                                     │
│   [Posts Widget / Loop Grid: 3 columns, 9 per page] │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │ Cat badge│ │ Cat badge│ │ Cat badge│           │
│   │ Title    │ │ Title    │ │ Title    │           │
│   │ 📍 Loc   │ │ 📍 Loc   │ │ 📍 Loc   │           │
│   │ 💰 Comp  │ │ 💰 Comp  │ │ 💰 Comp  │           │
│   │ Excerpt  │ │ Excerpt  │ │ Excerpt  │           │
│   │ [Learn→] │ │ [Learn→] │ │ [Learn→] │           │
│   └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│   [Pagination: 1 2 ... 6 Last Page]                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.3 Single FAQ Template

**Template Name:** `single-faq`
**Condition:** All Singular → FAQs
**Layout:** Single Column, 800px max-width

```
┌─────────────────────────────────────────────────────┐
│ [SECTION: Breadcrumb — Padding sm]                  │
│   Help Center > {faq_category} > {title}            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: Content — Padding xl]                     │
│                                                     │
│   [Heading: Dynamic Tag → Post Title] — H1          │
│   [Text Editor: Dynamic Tag → Post Content]         │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [SECTION: CTA — Padding lg]                         │
│                                                     │
│   [Text: "Still need help?"]                        │
│   [Button: "Contact Us" → /contact-us-2/]           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.4 FAQ Archive / Help Center Template

**Template Name:** `archive-faq`
**Condition:** All Archives → FAQs
**Layout:** Two-Column (sidebar + content), 1200px container

```
┌──────────────────────┬──────────────────────────────┐
│ [SIDEBAR: 280px]     │ [MAIN CONTENT: flex-1]       │
│                      │                              │
│ Categories:          │ [Heading: "Help Center"] H1  │
│ ☐ General Inquiries  │ [Text: intro paragraph]      │
│ ☐ My Account         │                              │
│ ☐ Troubleshooting    │ [Posts Widget: faq CPT,      │
│ ☐ Online Safety      │  ordered alphabetically,     │
│ ☐ Project Help       │  title-only list,            │
│ ☐ Payment Issues     │  linked to single-faq]       │
│ ☐ Certifications     │                              │
│                      │                              │
│ [Dropdown version    │                              │
│  for mobile]         │                              │
│                      │                              │
└──────────────────────┴──────────────────────────────┘
```

---

## 8. Page Specifications

### 8.1 Homepage

**Sections (top to bottom):**

| # | Section | Elementor Widgets | Data Source |
|---|---|---|---|
| 1 | Hero | Heading (H1), Text Editor, 2x Button, Image | Static content |
| 2 | Stats Counter | 4x Counter widget (1.8M, 300+, 222, 20K) | Static content |
| 3 | Category Grid | 5x Icon Box widgets in columns | Static content + links to `/jobs/type/{slug}` |
| 4 | Featured Jobs | Carousel/Slider OR Posts widget (3 latest jobs) | Dynamic → `job` CPT query |
| 5 | Onboarding Steps | 5x Icon Box or Timeline widget | Static content |
| 6 | Help CTA | Heading, Text, Button, Image | Static content |

### 8.2 How OneForma Works

| # | Section | Content |
|---|---|---|
| 1 | Hero | Heading + subtitle + CTA |
| 2 | 5-Step Guide | Number + heading + description per step |
| 3 | Stats / Social Proof | Community size, expertise levels |
| 4 | CTA | "Join OneForma" button → my.oneforma.com/Account/register |

### 8.3 Domain Experts

| # | Section | Content |
|---|---|---|
| 1 | Hero | H1 + bullet points + "Apply Now" CTA |
| 2 | Why Domain Experts | Two-column (text + image) |
| 3 | How Experts Contribute | Text + "Apply Now" CTA |
| 4 | Compensation & Flexibility | Text + CTA |
| 5 | Qualification Criteria | 4x checkmark items |
| 6 | About OneForma | Company description |
| 7 | Contact Form | Embedded CF7 form OR Elementor form popup |

### 8.4 Legal Pages (5 pages)

All legal pages use the same simple layout:

| Section | Widget |
|---|---|
| Breadcrumb | Breadcrumb widget or text |
| Title | Heading (H1) — Dynamic Tag → Post Title |
| Content | Text Editor — Dynamic Tag → Post Content |

**Create one Elementor Single template** for all legal pages with condition: Specific Pages → [list all 5].

---

## 9. Forms Specification

### 9.1 Contact Us Form

**Current:** CF7 with conditional fields (question type → shows/hides sub-options)

**Recommendation:** Keep CF7 in Phase 1 via Shortcode widget. Evaluate migration to Elementor Forms in Phase 2.

**Fields:**

| Field | Type | Required | Options |
|---|---|---|---|
| Name | Text | Yes | — |
| Email | Email | Yes | — |
| Question Type | Select | Yes | General Questions, Profile Management, Payment Issues, Humus Support, Centaurus Support, Application Status, Certification Assistance, UHRS Support, Milky Way Support, Other Support |
| Message | Textarea | No | — |
| hCaptcha | CAPTCHA | Yes | — |

**Actions on Submit:** Email notification to `usersupport@oneforma.com` (verify current recipient).

### 9.2 Domain Expert Application Form

**Fields:**

| Field | Type | Required |
|---|---|---|
| Your Name | Text | Yes |
| Your Email | Email | Yes |
| Subject | Text | Yes |
| Your Message | Textarea | No |

### 9.3 hCaptcha Integration

- If using CF7: hCaptcha plugin continues to inject CAPTCHA automatically
- If using Elementor Forms: Install Elementor hCaptcha add-on OR use the existing hCaptcha plugin's Elementor integration

---

## 10. Navigation & Menu Spec

### 10.1 Header Navigation

**Menu Name:** `Primary Navigation`

| Order | Label | URL | Type | Visibility |
|---|---|---|---|---|
| 1 | How OneForma Works | `/how-oneforma-works/` | Page link | Always |
| 2 | Domain Experts | `/domain-expert/` | Page link | Always |
| 3 | Jobs | `/jobs/` | CPT archive link | Always |
| 4 | Log In | `my.oneforma.com/Account/login` | External link | Always |
| 5 | Join | `my.oneforma.com/Account/register` | External link (styled as button) | Always |

### 10.2 Footer Navigation

**Column 1: Account**
- Join OneForma → `my.oneforma.com/Account/register`
- Log In → `my.oneforma.com/Account/login`

**Column 2: Navigation**
- How OneForma Works → `/how-oneforma-works/`
- Domain Experts → `/domain-experts/`
- Jobs → `/jobs/`
- Help Center → `/help-center/`
- Contact Us → `/contact-us-2/`

**Column 3: Social**
- LinkedIn → `linkedin.com/company/oneformaglobal`
- Instagram → `instagram.com/oneforma.global/`
- Facebook → `facebook.com/profile.php?id=61565741623189`
- Twitter/X → `twitter.com/OneForma_cm`

**Footer Bottom Bar:**
- (c) 2026 OneForma. All Rights Reserved.
- Terms and Conditions | Code of Conduct | Privacy Policy | GDPR | Cookie Policy | Fraud and Scam Awareness

---

## 11. Analytics Integration Spec

### Integration Method

All analytics are injected via **Google Tag Manager** (container `GTM-NR965959`), which is theme-independent. The GTM snippet must be present in the `<head>` of every page.

### Elementor GTM Injection Options

**Option A (Recommended): Hello Elementor hooks**

Add to `functions.php` of a child theme or the `oneforma-helpers.php` mu-plugin:

```php
add_action( 'wp_head', function() {
    ?>
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-NR965959');</script>
    <!-- End Google Tag Manager -->
    <?php
}, 1 );

add_action( 'wp_body_open', function() {
    ?>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NR965959"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    <?php
}, 1 );
```

**Option B: Elementor Custom Code (Pro feature)**

Elementor Pro → Site Settings → Custom Code → `<head>` section.

### Validation Checklist

| Tracker | How to Verify | Expected |
|---|---|---|
| GTM | Browser DevTools → Network → `gtm.js` | `GTM-NR965959` loads |
| GA4 (Primary) | Network → `collect?tid=G-QYQZLRHQFR` | Hits sent to SGTM |
| GA4 (Secondary) | Network → `collect?tid=G-D36BJJJV7S` | Hits sent to SGTM |
| Facebook Pixel | Network → `fbevents.js` + `tr/` | Pixel `925864871981853` fires |
| LinkedIn | Network → `insight.min.js` + `wa/` | Partner `7953745` fires |
| Clarity | Network → `clarity.js` + `collect` | Project `v65pc8ejaz` records |
| Cloudflare RUM | Network → `beacon.min.js` + `cdn-cgi/rum` | Beacon fires |
| Custom cookies | Application → Cookies | `_of_vid`, `_of_sid`, `_of_dfp` present |

---

## 12. Performance Budget

### Current Baseline (from audit)

| Metric | Current Value |
|---|---|
| Total Resources | 72 |
| JS Files | 17 |
| CSS Files | 5 |
| Font Files | 11 |
| Total Page Weight | ~1.5–2 MB (estimated) |

### Target Budget (Post-Elementor)

| Metric | Target | Max Acceptable |
|---|---|---|
| Largest Contentful Paint (LCP) | < 2.5s | < 4.0s |
| First Input Delay (FID) | < 100ms | < 300ms |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.25 |
| Total Page Weight | < 2.5 MB | < 3.5 MB |
| DOM Nodes | < 1500 | < 2000 |
| JS Execution Time | < 2s | < 3.5s |

### Elementor Performance Mitigations

1. **Enable Improved Asset Loading** — Only loads widget CSS/JS used on the page
2. **Enable Improved CSS Loading** — Generates minimal CSS per page
3. **Element Manager** — Disable unused widgets (Lottie, Animated Headline, etc.)
4. **Lazy load images** — Elementor native + browser-native `loading="lazy"`
5. **Reduce DOM complexity** — Avoid excessive nesting; use Flexbox/Grid containers
6. **Cloudflare caching** — Cache Elementor-generated static assets aggressively

---

## 13. SEO Continuity Spec

### URL Structure Preservation

| Content Type | Current URL Pattern | After Migration | Change? |
|---|---|---|---|
| Homepage | `/` | `/` | No |
| Pages | `/{slug}/` | `/{slug}/` | No |
| Jobs | `/jobs/{slug}/` | `/jobs/{slug}/` | No |
| Job Archive | `/jobs/` | `/jobs/` | No |
| Job Type Archive | `/jobs/type/{slug}` | `/jobs/type/{slug}` | No |
| FAQ Articles | `/help-center/{category}/{slug}/` | `/help-center/{category}/{slug}/` | No |
| Blog Posts | `/{slug}/` | `/{slug}/` | No |

**All URLs remain identical.** No redirects needed for the theme switch.

### Schema Markup Continuity

Yoast SEO Premium generates all schema markup independently of the theme. Verified types:

- `Organization` (with logo, sameAs)
- `WebSite` (with SearchAction)
- `CollectionPage`
- `BreadcrumbList`

These will continue to generate correctly after theme switch.

### Meta Tag Continuity

Yoast SEO generates all meta tags (`<title>`, `meta description`, OG tags, Twitter cards) via `wp_head` hook — theme-independent.

### Known SEO Issue to Fix During Migration

The Help Center page has an accidental meta description:
```
"THIS PAGE IS REQUIRED AND NEEDS TO HAVE THE TEMPLATE SET TO 'HELP CENTER'. THIS CONTENT WILL NOT BE RENDERED."
```

**Action:** Update Yoast meta description for the Help Center page to:
```
"Find answers to common questions about OneForma — account setup, payments, projects, certifications, and more."
```

---

## 14. Pipeline Integration Validation

### Test Protocol

Run the following end-to-end test after each major phase:

#### Step 1: Create Test Job via REST API

```bash
curl -X POST "https://staging.oneforma.com/wp-json/wp/v2/job" \
  -H "Authorization: Basic $(echo -n 'supabot:APP_PASSWORD' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TEST — Migration Validation Job",
    "content": "<h2>Description:</h2><p>This is a test job created to validate the Elementor migration.</p><h2>Requirements:</h2><ul><li>Test requirement 1</li><li>Test requirement 2</li></ul>",
    "status": "publish",
    "slug": "test-migration-validation",
    "excerpt": "Test job for Elementor migration validation. Apply now on OneForma.",
    "acf": {
      "apply_job_title": "This role is available in 2 languages",
      "apply_job_description": "Select the one most relevant to you.",
      "apply_job": [
        {"language": "English", "apply_url": "https://my.oneforma.com/crowd/jobs/99998"},
        {"language": "Spanish", "apply_url": "https://my.oneforma.com/crowd/jobs/99999"}
      ]
    }
  }'
```

#### Step 2: Set Taxonomies

```bash
# Set job_type
curl -X POST "https://staging.oneforma.com/wp-json/wp/v2/job/{POST_ID}" \
  -H "Authorization: Basic $(echo -n 'supabot:APP_PASSWORD' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"job_type": [TERM_ID]}'
```

#### Step 3: Validate Rendering

- [ ] Visit `/jobs/test-migration-validation/`
- [ ] Verify title renders
- [ ] Verify content HTML renders (Description + Requirements)
- [ ] Verify `job_type` badge shows
- [ ] Verify `job_tag` badges show
- [ ] Verify ACF `apply_job_title` renders
- [ ] Verify ACF `apply_job_description` renders
- [ ] Verify ACF `apply_job` repeater renders 2 buttons
- [ ] Verify "Apply in English" links to correct URL
- [ ] Verify "Apply in Spanish" links to correct URL
- [ ] Verify job appears in `/jobs/` archive

#### Step 4: Cleanup

```bash
curl -X DELETE "https://staging.oneforma.com/wp-json/wp/v2/job/{POST_ID}?force=true" \
  -H "Authorization: Basic $(echo -n 'supabot:APP_PASSWORD' | base64)"
```

#### Step 5: Full Pipeline Test

Run the centric-intake worker against staging:

```bash
cd /Users/stevenjunop/centric-intake/worker
WP_SITE_URL=https://staging.oneforma.com python main.py
```

Submit a test intake form and verify the job publishes end-to-end.

---

## 15. Plugin Manifest

### Required Plugins (Post-Migration)

| Plugin | Version | License | Purpose | Status |
|---|---|---|---|---|
| **Hello Elementor** | Latest | Free | Base theme | Install |
| **Elementor Pro** | Latest | Paid ($59+/yr) | Theme Builder, Dynamic Tags, Forms | Purchase + Install |
| **ACF Pro** | 6.x+ | Paid ($49/yr) | Custom fields, repeater fields | Verify installed |
| **Yoast SEO Premium** | 25.6 | Paid | SEO | Keep (no change) |
| **hCaptcha** | Latest | Free | Bot protection | Keep (no change) |
| **Redirection** | Latest | Free | URL redirects, 404 logging | Keep (no change) |
| **hu-manity.co** | Latest | Free/Paid | Cookie consent | Keep (no change) |

### Plugins to Evaluate for Removal

| Plugin | Reason | Action |
|---|---|---|
| **Contact Form 7** | Elementor Pro has built-in forms | Keep in Phase 1, evaluate removal in Phase 2 |
| **CF7 Conditional Fields** | Only needed if CF7 is kept | Follows CF7 decision |

### New Plugin / Must-Use Plugin

| Plugin | Type | Purpose |
|---|---|---|
| **oneforma-helpers.php** | Must-Use Plugin (`/wp-content/mu-plugins/`) | Custom shortcodes: `[job_apply_buttons]`, `[job_meta_badges]`, `[job_type_badge]`, GTM injection |

---

## 16. File & Asset Manifest

### Assets to Migrate from Current Theme

Download from `/wp-content/themes/oneforma2025/assets/` and upload to WordPress Media Library:

#### Icons (SVG)

| Filename | New Media Library Name | Usage |
|---|---|---|
| `annotation-icon.svg` | of-icon-annotation | Category grid, job cards |
| `data-collection-icon.svg` | of-icon-data-collection | Category grid, job cards |
| `judging-icon.svg` | of-icon-judging | Category grid, job cards |
| `transcription-icon.svg` | of-icon-transcription | Category grid, job cards |
| `translation-icon.svg` | of-icon-translation | Category grid, job cards |
| `location-icon.svg` | of-icon-location | Job meta badges |
| `dollar-icon.svg` | of-icon-dollar | Job meta badges |
| `community-icon.svg` | of-icon-community | Onboarding steps |
| `certificate-icon.svg` | of-icon-certificate | Onboarding steps |
| `explore-icon.svg` | of-icon-explore | Onboarding steps |
| `ai-chip-icon.svg` | of-icon-ai-chip | Onboarding steps |
| `earn-icon.svg` | of-icon-earn | Onboarding steps |

#### Logos

| Filename | Usage |
|---|---|
| `oneforma-logo.svg` | Header logo |
| `oneforma-logo-white.png` | Footer logo |

#### Fonts

| Filename | Weight |
|---|---|
| `Roboto-Thin.woff` + `.woff2` | 100 |
| `Roboto-Light.woff` + `.woff2` | 300 |
| `Roboto-Regular.woff` + `.woff2` | 400 |
| `Roboto-Medium.woff` + `.woff2` | 500 |
| `Roboto-Bold.woff` + `.woff2` | 700 |

#### Images (already in Media Library)

These are already uploaded to `/wp-content/uploads/` and will persist:
- `header-img.png` (homepage hero)
- `easy-get-started.webp` (onboarding section)
- `help-businesses-img.png` (help CTA section)
- `cropped-favicon-276x276.png` (site icon)

### Files to Create

| File | Location | Purpose |
|---|---|---|
| `oneforma-helpers.php` | `/wp-content/mu-plugins/` | Shortcodes + GTM injection |

### Files Deprecated (Remove After Migration)

| File / Directory | Reason |
|---|---|
| `/wp-content/themes/oneforma2025/` | Entire old theme (keep for 2 weeks as rollback) |

---

*Specification created April 28, 2026. This is a living document — update as decisions are made during migration.*
