"""Content Format Intelligence — maps persona × platform × format to engagement.

Each platform has multiple content format options. A carousel on LinkedIn
engages freelancers differently than a Reel on Instagram engages students.
This module maps the full matrix so the pipeline selects the RIGHT format
for each persona on each platform.

Format selection feeds into:
- Stage 1: Brief (which formats to produce per persona × platform)
- Stage 4: Compositor (what templates/dimensions to render)
- Copy: Different copy constraints per format
- Creative direction: Different visual approaches per format
"""
from __future__ import annotations

from typing import Any


# =========================================================================
# PLATFORM FORMAT REGISTRY
# Each platform's available content formats with specs and engagement data
# =========================================================================

PLATFORM_FORMATS: dict[str, dict[str, dict[str, Any]]] = {

    # -----------------------------------------------------------------
    # META / FACEBOOK
    # -----------------------------------------------------------------
    "facebook": {
        "single_image": {
            "display_name": "Single Image Post",
            "dimensions": ["1080x1080", "1200x628"],
            "aspect_ratios": ["1:1", "1.91:1"],
            "copy_fields": ["primary_text", "headline", "description", "cta_button"],
            "engages_best": [],
            "engagement_style": "Stop-scroll visual + benefit headline. Works for all ages in countries where Facebook is still dominant (LATAM, SEA, Africa, MENA).",
            "creative_approach": "Clear benefit text overlay, warm colors, relatable person in frame",
            "avoid": "Text-heavy, corporate stock, landscape-only (square performs better)",
        },
        "carousel": {
            "display_name": "Carousel (up to 10 cards)",
            "dimensions": ["1080x1080"],
            "aspect_ratios": ["1:1"],
            "panels": {"min": 2, "max": 10, "recommended": 5},
            "copy_fields": ["primary_text", "per_card_headline", "per_card_description", "cta_button"],
            "engages_best": [],
            "engagement_style": "Swipeable story — each card reveals a benefit or step. Great for 'How it works' or 'What you earn' breakdowns.",
            "creative_approach": "Panel 1 = hook, panels 2-4 = value/proof, panel 5 = CTA. Consistent visual thread across cards.",
            "avoid": "Disconnected cards, text walls, starting with logo",
        },
        "video": {
            "display_name": "Video (in-feed)",
            "dimensions": ["1080x1080", "1080x1920"],
            "aspect_ratios": ["1:1", "9:16"],
            "duration": {"min_sec": 5, "max_sec": 240, "recommended_sec": 15},
            "copy_fields": ["primary_text", "headline", "cta_button"],
            "engages_best": [],
            "engagement_style": "UGC-style 'day in the life' or testimonial. First 3 seconds must hook.",
            "creative_approach": "Person talking to camera OR screen recording of annotation work. Subtitles mandatory.",
            "avoid": "Corporate b-roll, no subtitles, slow intros",
        },
        "stories": {
            "display_name": "Stories (vertical full-screen)",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "duration": {"max_sec": 15},
            "copy_fields": ["primary_text", "cta_button", "sticker_text"],
            "engages_best": [],
            "engagement_style": "Ephemeral, urgent feel. Swipe-up CTA. Quick testimonial or earnings reveal.",
            "creative_approach": "Full-bleed photo/video, minimal text overlay, swipe-up CTA",
            "avoid": "Dense text, horizontal images, slow reveal",
        },
        "reels": {
            "display_name": "Reels (short-form vertical video)",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "duration": {"min_sec": 3, "max_sec": 90, "recommended_sec": 30},
            "copy_fields": ["caption", "hashtags"],
            "engages_best": [],
            "engagement_style": "TikTok-style native content. Trending audio + relatable scenario.",
            "creative_approach": "POV: 'You earn $X annotating AI data from your couch'. Quick cuts, trending sounds.",
            "avoid": "Looking like an ad, no trending audio, corporate tone",
        },
    },

    # -----------------------------------------------------------------
    # INSTAGRAM
    # -----------------------------------------------------------------
    "instagram": {
        "feed_post": {
            "display_name": "Feed Post (image)",
            "dimensions": ["1080x1080", "1080x1350"],
            "aspect_ratios": ["1:1", "4:5"],
            "copy_fields": ["caption", "hashtags"],
            "engages_best": [],
            "engagement_style": "Aesthetic, aspirational. 4:5 portrait gets more screen real estate on mobile.",
            "creative_approach": "Clean composition, person + workspace, benefit text overlay, save-worthy",
            "avoid": "Landscape orientation, heavy text, corporate graphics",
        },
        "carousel": {
            "display_name": "Carousel (up to 10 slides)",
            "dimensions": ["1080x1080", "1080x1350"],
            "aspect_ratios": ["1:1", "4:5"],
            "panels": {"min": 2, "max": 10, "recommended": 7},
            "copy_fields": ["caption", "per_slide_text", "hashtags"],
            "engages_best": [],
            "engagement_style": "Educational/infographic style. 'Save this for later' energy. Highest save rate of any format.",
            "creative_approach": "Slide 1 = bold question/hook, slides 2-6 = answer/steps, slide 7 = CTA. Consistent design system.",
            "avoid": "Inconsistent design, no hook on slide 1, skipping the save-worthy value",
        },
        "stories": {
            "display_name": "Stories (vertical)",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "duration": {"max_sec": 15},
            "copy_fields": ["text_overlay", "cta_sticker", "poll_sticker"],
            "engages_best": [],
            "engagement_style": "Interactive — polls, questions, swipe-up links. Feels personal.",
            "creative_approach": "Behind-the-scenes, 'ask me anything', polls ('Would you do this?'), earnings reveals",
            "avoid": "Static images without interactivity, dense text",
        },
        "reels": {
            "display_name": "Reels (short-form video)",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "duration": {"min_sec": 3, "max_sec": 90, "recommended_sec": 15},
            "copy_fields": ["caption", "hashtags"],
            "engages_best": [],
            "engagement_style": "Highest reach format on Instagram. Algorithm-boosted. Trending audio critical.",
            "creative_approach": "Hook in first 1s, face on camera, relatable scenario, trending audio",
            "avoid": "Looking like an ad, no face, landscape, watermarks from TikTok",
        },
    },

    # -----------------------------------------------------------------
    # LINKEDIN
    # -----------------------------------------------------------------
    "linkedin": {
        "single_image": {
            "display_name": "Single Image Post",
            "dimensions": ["1200x627", "1080x1080"],
            "aspect_ratios": ["1.91:1", "1:1"],
            "copy_fields": ["introductory_text", "headline", "description", "cta_button"],
            "engages_best": [],
            "engagement_style": "Professional but human. Personal story + benefit image.",
            "creative_approach": "Person in professional-casual setting, benefit headline overlay, OneForma branding subtle",
            "avoid": "Stock photos, overly corporate, no human face",
        },
        "carousel": {
            "display_name": "Document/Carousel (PDF slides)",
            "dimensions": ["1080x1080", "1080x1350"],
            "aspect_ratios": ["1:1", "4:5"],
            "panels": {"min": 2, "max": 20, "recommended": 8},
            "copy_fields": ["introductory_text", "per_slide_content"],
            "engages_best": [],
            "engagement_style": "Highest engagement format on LinkedIn. Educational, swipeable, save-worthy. Dwell time is massive.",
            "creative_approach": "Bold statement per slide, data/stats, 'What I learned annotating AI data' angle, professional design",
            "avoid": "Too many words per slide, no visual hierarchy, boring corporate template",
        },
        "video": {
            "display_name": "Video (native)",
            "dimensions": ["1920x1080", "1080x1080", "1080x1920"],
            "aspect_ratios": ["16:9", "1:1", "9:16"],
            "duration": {"min_sec": 3, "max_sec": 600, "recommended_sec": 60},
            "copy_fields": ["introductory_text", "hashtags"],
            "engages_best": [],
            "engagement_style": "Thought leadership / testimonial style. Face to camera with subtitles.",
            "creative_approach": "Contributor testimonial, 'How I earn $X/week with AI annotation', professional but authentic",
            "avoid": "No subtitles, landscape talking head with no movement, too long (>2min)",
        },
        "text_only": {
            "display_name": "Text Post (no media)",
            "dimensions": [],
            "aspect_ratios": [],
            "copy_fields": ["post_text"],
            "char_limit": 3000,
            "engages_best": [],
            "engagement_style": "Personal narrative / thread style. High engagement when story is compelling.",
            "creative_approach": "First line = hook. Story format: problem → discovery → result. End with CTA.",
            "avoid": "Wall of text, no line breaks, corporate announcement tone",
        },
    },

    # -----------------------------------------------------------------
    # TIKTOK
    # -----------------------------------------------------------------
    "tiktok": {
        "in_feed_video": {
            "display_name": "In-Feed Video",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "duration": {"min_sec": 5, "max_sec": 180, "recommended_sec": 21},
            "copy_fields": ["ad_text", "cta_button", "display_name"],
            "engages_best": [],
            "engagement_style": "Native creator content. Must NOT look like an ad. First 1s = everything.",
            "creative_approach": "POV format, face on camera, trending sound, 'I earn $X doing THIS from home', quick cuts",
            "avoid": "Corporate production, no trending audio, slow intro, landscape",
        },
        "spark_ads": {
            "display_name": "Spark Ads (boosted organic)",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "duration": {"recommended_sec": 15},
            "copy_fields": ["ad_text", "cta_button"],
            "engages_best": [],
            "engagement_style": "Looks like organic content with a subtle 'Sponsored' tag. Highest trust.",
            "creative_approach": "Partner with real contributors to create testimonials. Boost their organic posts.",
            "avoid": "Polished production, scripted feel, non-diverse creators",
        },
        "image_ads": {
            "display_name": "Image Ad (static in feed)",
            "dimensions": ["1080x1920", "1200x628"],
            "aspect_ratios": ["9:16", "1.91:1"],
            "copy_fields": ["ad_text", "cta_button"],
            "engages_best": [],
            "engagement_style": "Less common on TikTok but available. Works for retargeting, not cold traffic.",
            "creative_approach": "Bold benefit statement, person with phone, clear CTA",
            "avoid": "Using as primary format (video always wins on TikTok)",
        },
    },

    # -----------------------------------------------------------------
    # TELEGRAM
    # -----------------------------------------------------------------
    "telegram": {
        "channel_post_image": {
            "display_name": "Channel Post (image + text)",
            "dimensions": ["1280x720", "1080x1080"],
            "aspect_ratios": ["16:9", "1:1"],
            "copy_fields": ["message_text", "button_text", "button_url"],
            "engages_best": [],
            "engagement_style": "Direct, community-feel. Like a trusted admin sharing an opportunity.",
            "creative_approach": "Clean image with benefit, conversational caption, inline button CTA",
            "avoid": "Spammy, ALL CAPS, multiple exclamation marks, too many emojis",
        },
        "sponsored_message": {
            "display_name": "Sponsored Message (text-only)",
            "dimensions": [],
            "aspect_ratios": [],
            "copy_fields": ["message_text", "button_text", "button_url"],
            "char_limit": 160,
            "engages_best": [],
            "engagement_style": "Short, direct, appears in channels. Must be ultra-concise.",
            "creative_approach": "One benefit + one CTA. 'Earn $X/hr annotating AI data. Flexible. Remote. → Join now'",
            "avoid": "Long text, vague benefits, no CTA button",
        },
        "channel_post_video": {
            "display_name": "Channel Post (video + text)",
            "dimensions": ["1080x1920", "1920x1080"],
            "aspect_ratios": ["9:16", "16:9"],
            "duration": {"recommended_sec": 30},
            "copy_fields": ["message_text", "button_text"],
            "engages_best": [],
            "engagement_style": "Auto-plays in feed. Testimonial or demo of the work.",
            "creative_approach": "Screen recording of annotation interface + voiceover, or contributor testimonial",
            "avoid": "Horizontal on mobile-first platform, no context/caption",
        },
    },

    # -----------------------------------------------------------------
    # REDDIT
    # -----------------------------------------------------------------
    "reddit": {
        "promoted_post_image": {
            "display_name": "Promoted Post (image)",
            "dimensions": ["1200x628", "1080x1080"],
            "aspect_ratios": ["1.91:1", "1:1"],
            "copy_fields": ["post_title", "post_text", "cta_button"],
            "engages_best": [],
            "engagement_style": "Must feel like a genuine community post, NOT an ad. Reddit hates ads.",
            "creative_approach": "Transparent: 'I work for OneForma, AMA about data annotation' or value-first post.",
            "subreddit_targets": ["r/beermoney", "r/WorkOnline", "r/remotework", "r/sidehustle", "r/forhire"],
            "avoid": "Corporate language, clickbait, not disclosing it's promoted, hard-sell CTA",
        },
        "promoted_post_video": {
            "display_name": "Promoted Post (video)",
            "dimensions": ["1920x1080"],
            "aspect_ratios": ["16:9"],
            "duration": {"recommended_sec": 30},
            "copy_fields": ["post_title", "post_text"],
            "engages_best": [],
            "engagement_style": "Explainer or testimonial that adds VALUE to the subreddit.",
            "creative_approach": "Screen recording of actual annotation work, 'This is what I do for $X/hr'",
            "avoid": "Polished production (screams 'ad'), not matching subreddit culture",
        },
        "organic_post": {
            "display_name": "Organic Community Post (free)",
            "dimensions": [],
            "aspect_ratios": [],
            "copy_fields": ["post_title", "post_text"],
            "engages_best": [],
            "engagement_style": "Genuine community contribution. AMA, earnings report, tips & tricks.",
            "creative_approach": "'I've been doing AI data annotation for 6 months — here's what I've learned' format",
            "avoid": "Sounding like marketing, not engaging with comments, posting and ghosting",
        },
    },

    # -----------------------------------------------------------------
    # PINTEREST
    # -----------------------------------------------------------------
    "pinterest": {
        "standard_pin": {
            "display_name": "Standard Pin (image)",
            "dimensions": ["1000x1500"],
            "aspect_ratios": ["2:3"],
            "copy_fields": ["pin_title", "pin_description", "destination_url"],
            "engages_best": [],
            "engagement_style": "Aspirational, save-for-later. 'Work from home aesthetic' boards.",
            "creative_approach": "Beautiful workspace photo, overlay text with benefit, link to landing page",
            "avoid": "Ugly graphics, no text overlay, landscape orientation (2:3 is king)",
        },
        "idea_pin": {
            "display_name": "Idea Pin (multi-page)",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "panels": {"min": 2, "max": 20, "recommended": 5},
            "copy_fields": ["per_page_text", "hashtags"],
            "engages_best": [],
            "engagement_style": "Step-by-step guide format. 'How to start earning from home' tutorial.",
            "creative_approach": "Step 1: Sign up → Step 2: Choose tasks → Step 3: Start earning. Clean design per page.",
            "avoid": "No educational value, pure advertisement, inconsistent design",
        },
        "video_pin": {
            "display_name": "Video Pin",
            "dimensions": ["1080x1920", "1000x1500"],
            "aspect_ratios": ["9:16", "2:3"],
            "duration": {"min_sec": 4, "max_sec": 300, "recommended_sec": 20},
            "copy_fields": ["pin_title", "pin_description"],
            "engages_best": [],
            "engagement_style": "Tutorial or 'day in my life' format. Autoplay in feed.",
            "creative_approach": "Aesthetic workspace tour, 'My morning routine as a data annotator', calming energy",
            "avoid": "Hard-sell, fast cuts (Pinterest is calm/aspirational), corporate tone",
        },
    },

    # -----------------------------------------------------------------
    # YOUTUBE
    # -----------------------------------------------------------------
    "youtube": {
        "shorts": {
            "display_name": "YouTube Shorts (vertical)",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "duration": {"max_sec": 60, "recommended_sec": 30},
            "copy_fields": ["title", "description"],
            "engages_best": [],
            "engagement_style": "TikTok-style but YouTube audience is slightly older and more intentional.",
            "creative_approach": "Quick hook, show the work, show the earnings, CTA to sign up",
            "avoid": "No hook, too long, no face on camera",
        },
        "pre_roll": {
            "display_name": "Pre-Roll / Skippable In-Stream Ad",
            "dimensions": ["1920x1080"],
            "aspect_ratios": ["16:9"],
            "duration": {"min_sec": 5, "max_sec": 30, "recommended_sec": 15},
            "copy_fields": ["headline", "cta_button", "companion_banner"],
            "engages_best": [],
            "engagement_style": "5-second hook before skip button. Must convey value FAST.",
            "creative_approach": "'What if you could earn $15/hr from home?' — face on camera, benefit in first 3s",
            "avoid": "Slow brand intro, no skip-hook, talking about the company instead of the viewer",
        },
    },

    # -----------------------------------------------------------------
    # X / TWITTER
    # -----------------------------------------------------------------
    "twitter": {
        "promoted_tweet_image": {
            "display_name": "Promoted Tweet (image card)",
            "dimensions": ["1200x675", "800x418"],
            "aspect_ratios": ["1.91:1"],
            "copy_fields": ["tweet_text", "card_headline", "card_description"],
            "engages_best": [],
            "engagement_style": "Conversational, witty, hashtaggable. Must feel like a real tweet.",
            "creative_approach": "Hot take or question + benefit image card. 'Unpopular opinion: data annotation > food delivery'",
            "avoid": "Corporate language, hashtag stuffing, looking like an ad",
        },
        "promoted_tweet_video": {
            "display_name": "Promoted Tweet (video)",
            "dimensions": ["1920x1080", "1080x1080"],
            "aspect_ratios": ["16:9", "1:1"],
            "duration": {"recommended_sec": 15},
            "copy_fields": ["tweet_text"],
            "engages_best": [],
            "engagement_style": "Short, punchy, quote-tweetable. Conversation-starting.",
            "creative_approach": "Quick testimonial clip, screen recording, or provocative statement with proof",
            "avoid": "Long videos, no subtitles, corporate b-roll",
        },
        "thread": {
            "display_name": "Thread (multi-tweet)",
            "dimensions": [],
            "aspect_ratios": [],
            "copy_fields": ["thread_tweets"],
            "panels": {"min": 3, "max": 15, "recommended": 7},
            "engages_best": [],
            "engagement_style": "Storytelling format. High engagement when genuine. Builds authority.",
            "creative_approach": "Tweet 1 = hook, tweets 2-6 = story/value, tweet 7 = CTA + link",
            "avoid": "Generic advice, no personal angle, not threading properly",
        },
    },

    # -----------------------------------------------------------------
    # WECHAT
    # -----------------------------------------------------------------
    "wechat": {
        "moments_ad": {
            "display_name": "Moments Ad (feed)",
            "dimensions": ["1080x1080", "1280x720"],
            "aspect_ratios": ["1:1", "16:9"],
            "copy_fields": ["ad_text", "cta_button", "brand_name"],
            "engages_best": [],
            "engagement_style": "Native to WeChat Moments feed. Must feel like a friend's post.",
            "creative_approach": "Relatable person, Mandarin copy, benefit-first, clear mini-program link",
            "avoid": "Looking foreign/imported, non-Mandarin copy, complex CTA flow",
        },
        "official_account_article": {
            "display_name": "Official Account Article",
            "dimensions": ["900x500"],
            "aspect_ratios": ["16:9"],
            "copy_fields": ["article_title", "article_body", "cta_button"],
            "engages_best": [],
            "engagement_style": "Long-form content marketing. Shared within groups. Builds trust over time.",
            "creative_approach": "Educational: 'How AI data annotation works and how you can earn from it'",
            "avoid": "Hard sell in first paragraph, no social proof, not optimized for mobile reading",
        },
        "mini_program_ad": {
            "display_name": "Mini Program Ad",
            "dimensions": ["1080x1920"],
            "aspect_ratios": ["9:16"],
            "copy_fields": ["ad_text", "cta_button"],
            "engages_best": [],
            "engagement_style": "Direct conversion — user can sign up within WeChat without leaving.",
            "creative_approach": "Simple benefit + 'Start in 2 minutes' CTA → mini program signup flow",
            "avoid": "Complex flows, requiring app download, external links",
        },
    },
}


# =========================================================================
# PERSONA × FORMAT ENGAGEMENT MATRIX
# Maps each persona archetype to their top-performing formats per platform
# =========================================================================

def get_best_formats_for_persona(
    persona_key: str,
    platforms: list[str],
) -> dict[str, list[dict[str, Any]]]:
    """Return the content formats available for a persona across platforms.

    With the legacy 8-archetype system deleted (Task 18/19), there are no
    hardcoded persona→format affinities. This function now returns every
    format defined for each platform so downstream callers can rank them
    using dynamic persona psychology or engagement heuristics.

    Parameters
    ----------
    persona_key:
        Opaque persona identifier (e.g. a dynamic matched_tier key).
        Currently unused for scoring — retained for API compatibility.
    platforms:
        List of platform keys to check.

    Returns
    -------
    dict mapping platform → list of format specs in declaration order.
    """
    del persona_key  # reserved for future persona-aware scoring
    results: dict[str, list[dict[str, Any]]] = {}

    for platform in platforms:
        platform_formats = PLATFORM_FORMATS.get(platform, {})
        results[platform] = [
            {
                "format_key": fmt_key,
                "display_name": spec["display_name"],
                "dimensions": spec.get("dimensions", []),
                "engagement_style": spec.get("engagement_style", ""),
                "creative_approach": spec.get("creative_approach", ""),
                "avoid": spec.get("avoid", ""),
                "score": 0,
            }
            for fmt_key, spec in platform_formats.items()
        ]

    return results


def build_format_matrix(
    personas: list[dict],
    platforms: list[str],
) -> dict[str, dict[str, list[dict]]]:
    """Build the full persona × platform × format matrix for a campaign.

    Returns a nested dict: persona_key → platform → [ranked formats].
    """
    matrix: dict[str, dict[str, list[dict]]] = {}

    for persona in personas:
        key = (
            persona.get("matched_tier")
            or persona.get("archetype_key")
            or persona.get("name")
            or persona.get("persona_name")
            or "unknown"
        )
        best_channels = persona.get("best_channels", platforms)
        # Use persona's channels if available, otherwise use provided platforms
        target_platforms = [
            p.replace("_feed", "").replace("_card", "").replace("_banner", "")
            for p in best_channels
        ]
        # Deduplicate while preserving order
        seen = set()
        unique_platforms = []
        for p in target_platforms:
            if p not in seen:
                seen.add(p)
                unique_platforms.append(p)

        matrix[key] = get_best_formats_for_persona(key, unique_platforms)

    return matrix


def build_format_brief_block(matrix: dict) -> str:
    """Format the persona × format matrix into a prompt-injectable block."""
    lines = ["CONTENT FORMAT STRATEGY (persona × platform × format):\n"]

    for persona_key, platforms in matrix.items():
        lines.append(f"  {persona_key}:")
        for platform, formats in platforms.items():
            if not formats:
                continue
            top = formats[0]
            lines.append(
                f"    {platform}: {top['display_name']} — {top['engagement_style'][:80]}..."
            )
            if len(formats) > 1:
                alt = formats[1]
                lines.append(f"      ALT: {alt['display_name']}")
        lines.append("")

    return "\n".join(lines)
