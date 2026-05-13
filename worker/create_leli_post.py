"""Create LELI job post — translation quality editing across 51 language pairs.

Project: LELI — Translation Evaluation (C821 Benjamin CCM)
Client: Benjamin
Type: Translation — Language Quality Editing (MTPE)
Locales: 51 language pairs, $0.012–$0.033/word, remote
Note: Russian (en_US-ru_RU) excluded — no application link provided.

Run: python3 create_leli_post.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from wp_rest_client import WordPressClient

# ─── SEO ────────────────────────────────────────────────────────────────────

TITLE = "Review & Refine Machine Translations in Your Language — Help AI-Powered Content Read Naturally Worldwide"

SLUG = "leli"

# Yoast meta description (via excerpt)
EXCERPT = (
    "Review and post-edit machine-generated translations to ensure accuracy, "
    "fluency, and natural tone. Remote, flexible, per-word pay "
    "($0.012\u2013$0.033/word). 51 language pairs including Arabic, Chinese, "
    "Japanese, Korean, Spanish, French, German, and more. Apply now on OneForma."
)

# ─── ACF Repeater: apply_job ────────────────────────────────────────────────
# Each row = one locale link in the "Apply for your language" section.
# Russian (en_US-ru_RU) omitted — link listed as "0" in source data.

ACF_APPLY_JOB = [
    {"language": "Arabic (Saudi Arabia)", "apply_url": "https://my.oneforma.com/crowd/jobs/12401?from=list&tab=all"},
    {"language": "Arabic (UAE)", "apply_url": "https://my.oneforma.com/crowd/jobs/12402?from=list&tab=all"},
    {"language": "Bangla (Bangladesh, India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12408?from=list&tab=all"},
    {"language": "Chinese Simplified \u2192 English (US)", "apply_url": "https://my.oneforma.com/crowd/jobs/12405?from=list&tab=all"},
    {"language": "Chinese Simplified", "apply_url": "https://my.oneforma.com/crowd/jobs/12404?from=list&tab=all"},
    {"language": "Chinese Traditional (Taiwan)", "apply_url": "https://my.oneforma.com/crowd/jobs/12411?from=list&tab=all"},
    {"language": "Danish (Denmark)", "apply_url": "https://my.oneforma.com/crowd/jobs/12417?from=list&tab=all"},
    {"language": "Dutch (Belgium)", "apply_url": "https://my.oneforma.com/crowd/jobs/12418?from=list&tab=all"},
    {"language": "Dutch (Netherlands)", "apply_url": "https://my.oneforma.com/crowd/jobs/12424?from=list&tab=all"},
    {"language": "English (Australia)", "apply_url": "https://my.oneforma.com/crowd/jobs/12421?from=list&tab=all"},
    {"language": "English (Canada)", "apply_url": "https://my.oneforma.com/crowd/jobs/12425?from=list&tab=all"},
    {"language": "English (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12428?from=list&tab=all"},
    {"language": "English (Ireland)", "apply_url": "https://my.oneforma.com/crowd/jobs/12432?from=list&tab=all"},
    {"language": "English (Singapore)", "apply_url": "https://my.oneforma.com/crowd/jobs/12435?from=list&tab=all"},
    {"language": "English (South Africa)", "apply_url": "https://my.oneforma.com/crowd/jobs/12437?from=list&tab=all"},
    {"language": "English (UK)", "apply_url": "https://my.oneforma.com/crowd/jobs/12442?from=list&tab=all"},
    {"language": "Filipino (Philippines)", "apply_url": "https://my.oneforma.com/crowd/jobs/12444?from=list&tab=all"},
    {"language": "Finnish (Finland)", "apply_url": "https://my.oneforma.com/crowd/jobs/12448?from=list&tab=all"},
    {"language": "French (Belgium)", "apply_url": "https://my.oneforma.com/crowd/jobs/12423?from=list&tab=all"},
    {"language": "French (Canada)", "apply_url": "https://my.oneforma.com/crowd/jobs/12430?from=list&tab=all"},
    {"language": "French (France)", "apply_url": "https://my.oneforma.com/crowd/jobs/12407?from=list&tab=all"},
    {"language": "German (Germany)", "apply_url": "https://my.oneforma.com/crowd/jobs/12410?from=list&tab=all"},
    {"language": "Greek (Greece)", "apply_url": "https://my.oneforma.com/crowd/jobs/12443?from=list&tab=all"},
    {"language": "Gujarati (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12434?from=list&tab=all"},
    {"language": "Hebrew (Israel)", "apply_url": "https://my.oneforma.com/crowd/jobs/12439?from=list&tab=all"},
    {"language": "Hindi (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12427?from=list&tab=all"},
    {"language": "Indonesian (Indonesia)", "apply_url": "https://my.oneforma.com/crowd/jobs/12416?from=list&tab=all"},
    {"language": "Italian (Italy)", "apply_url": "https://my.oneforma.com/crowd/jobs/12414?from=list&tab=all"},
    {"language": "Japanese (Japan)", "apply_url": "https://my.oneforma.com/crowd/jobs/12415?from=list&tab=all"},
    {"language": "Japanese (Japan) \u2192 English (US)", "apply_url": "https://my.oneforma.com/crowd/jobs/12426?from=list&tab=all"},
    {"language": "Kannada (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12403?from=list&tab=all"},
    {"language": "Korean (South Korea)", "apply_url": "https://my.oneforma.com/crowd/jobs/12419?from=list&tab=all"},
    {"language": "Malay (Malaysia)", "apply_url": "https://my.oneforma.com/crowd/jobs/12406?from=list&tab=all"},
    {"language": "Malayalam (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12409?from=list&tab=all"},
    {"language": "Marathi (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12420?from=list&tab=all"},
    {"language": "Norwegian Bokm\u00e5l (Norway)", "apply_url": "https://my.oneforma.com/crowd/jobs/12451?from=list&tab=all"},
    {"language": "Polish (Poland)", "apply_url": "https://my.oneforma.com/crowd/jobs/12431?from=list&tab=all"},
    {"language": "Portuguese (Brazil)", "apply_url": "https://my.oneforma.com/crowd/jobs/12436?from=list&tab=all"},
    {"language": "Portuguese (Portugal)", "apply_url": "https://my.oneforma.com/crowd/jobs/12455?from=list&tab=all"},
    {"language": "Punjabi (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12454?from=list&tab=all"},
    {"language": "Romanian (Romania)", "apply_url": "https://my.oneforma.com/crowd/jobs/12453?from=list&tab=all"},
    {"language": "Slovak (Slovakia)", "apply_url": "https://my.oneforma.com/crowd/jobs/12450?from=list&tab=all"},
    {"language": "Spanish (International)", "apply_url": "https://my.oneforma.com/crowd/jobs/12446?from=list&tab=all"},
    {"language": "Spanish (Mexico)", "apply_url": "https://my.oneforma.com/crowd/jobs/12449?from=list&tab=all"},
    {"language": "Spanish (Spain)", "apply_url": "https://my.oneforma.com/crowd/jobs/12422?from=list&tab=all"},
    {"language": "Spanish (US)", "apply_url": "https://my.oneforma.com/crowd/jobs/12456?from=list&tab=all"},
    {"language": "Swedish (Sweden)", "apply_url": "https://my.oneforma.com/crowd/jobs/12445?from=list&tab=all"},
    {"language": "Tamil (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12441?from=list&tab=all"},
    {"language": "Telugu (India)", "apply_url": "https://my.oneforma.com/crowd/jobs/12438?from=list&tab=all"},
    {"language": "Thai (Thailand)", "apply_url": "https://my.oneforma.com/crowd/jobs/12433?from=list&tab=all"},
    {"language": "Turkish (Turkey)", "apply_url": "https://my.oneforma.com/crowd/jobs/12440?from=list&tab=all"},
    {"language": "Vietnamese (Vietnam)", "apply_url": "https://my.oneforma.com/crowd/jobs/12429?from=list&tab=all"},
]

# ─── Gutenberg Content ──────────────────────────────────────────────────────

CONTENT = """\
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Your language expertise is exactly what global content needs</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Machine translation has come a long way, but it still misses the nuance, cultural context, and natural flow that only a native speaker can catch. Mistranslations, awkward phrasing, and terminology errors undermine trust — and when millions of users rely on that content, accuracy isn't optional.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>As a Language Quality Editor on this project, you'll review and post-edit machine-generated translations to ensure they read as if they were written by a native speaker from the start. Your work directly ensures that platforms, products, policies, and services are clearly understood and trusted by users worldwide.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What you'll do</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Your primary task is <strong>reviewing and post-editing machine-generated translations</strong> (Language Quality Editing). This includes:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>Evaluate machine output</strong> for accuracy, completeness, and linguistic correctness</li>
<li><strong>Correct errors</strong> — fix mistranslations, omissions, meaning distortion, and terminology issues</li>
<li><strong>Ensure natural fluency</strong> — the final text should read as if it were originally written in the target language</li>
<li><strong>Apply terminology and style standards</strong> — follow the client's glossary, style guide, and quality requirements</li>
<li><strong>Flag critical issues</strong> — identify meaning distortion, cultural sensitivity problems, or content that could mislead users</li>
<li><strong>Deliver publish-ready content</strong> within defined turnaround times</li>
</ul>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Why this matters</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>When a user in Tokyo, S\u00e3o Paulo, or Riyadh reads product documentation, a privacy policy, or a service description, they need to understand it completely — no ambiguity, no awkward phrasing, no errors that erode confidence. Your expertise ensures that localized content meets the same standard of clarity and trust as the original.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>This project spans <strong>51 language pairs</strong> across Europe, Asia, the Middle East, Latin America, and Africa. Every edit you make helps real users interact with technology in their own language, with confidence.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">How it works</h2>
<!-- /wp:heading -->

<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list">
<li><strong>Apply</strong> — select your language pair and confirm your eligibility</li>
<li><strong>Get onboarded</strong> — receive the client's terminology guide, style standards, and quality requirements</li>
<li><strong>Receive tasks</strong> — machine-translated content is assigned to you for review</li>
<li><strong>Edit &amp; refine</strong> — correct errors, improve fluency, and ensure the text meets quality standards</li>
<li><strong>Submit</strong> — deliver publish-ready content within the agreed turnaround time</li>
<li><strong>Get paid</strong> — receive per-word payment for each approved task</li>
</ol>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Who can participate</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You're eligible if you:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>Are a <strong>native speaker</strong> of the target language in your language pair</li>
<li>Have experience with <strong>translation, post-editing, or language quality review</strong></li>
<li>Can evaluate content for <strong>accuracy, completeness, and natural fluency</strong></li>
<li>Are comfortable working with <strong>terminology glossaries and style guides</strong></li>
<li>Can deliver <strong>consistent, high-quality work</strong> within deadlines</li>
</ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>Professional translators, linguists, and experienced post-editors are especially encouraged to apply.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What you'll need</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>A computer with a reliable internet connection</li>
<li>Native-level fluency in your target language</li>
<li>Strong command of English (source language for most pairs)</li>
<li>Attention to detail and a commitment to quality</li>
</ul>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:paragraph -->
<p><strong>Ready to put your language skills to work?</strong> Select your language pair below and apply.</p>
<!-- /wp:paragraph -->
"""

# ─── Taxonomies ──────────────────────────────────────────────────────────────

JOB_TYPES = ["Translation"]
JOB_TAGS = ["Remote", "Per Word", "MTPE", "Language Quality", "Post-Editing"]


# ─── Main ────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("LELI JOB POST \u2014 CREATE")
    print("Translation Evaluation | 51 Language Pairs | Per-Word Pay")
    print("=" * 60)

    async with WordPressClient() as wp:
        # Step 1: Check if slug already exists
        print("\n[1/4] Checking if 'leli' slug exists...")
        resp = await wp._client.get(
            f"{wp._api_base}/job",
            params={"slug": SLUG, "per_page": 1},
        )
        if resp.status_code == 200 and resp.json():
            existing = resp.json()[0]
            print(f"  Post already exists: ID={existing['id']}, status={existing['status']}")
            print(f"  Link: {existing.get('link')}")
            print(f"\n  Updating existing post instead...")
            update_resp = await wp._client.post(
                f"{wp._api_base}/job/{existing['id']}",
                json={
                    "title": TITLE,
                    "content": CONTENT,
                    "excerpt": EXCERPT,
                    "acf": {"apply_job": ACF_APPLY_JOB},
                },
            )
            if update_resp.status_code in (200, 201):
                r = update_resp.json()
                print(f"  Updated: ID={r['id']}")
                print(f"  Title:   {r.get('title', {}).get('rendered')}")
                print(f"  Link:    {r.get('link')}")
                acf = r.get("acf", {})
                print(f"  ACF:     {len(acf.get('apply_job', []))} locale entries")
            else:
                print(f"  ERROR: {update_resp.status_code} \u2014 {update_resp.text[:500]}")
            return

        # Step 2: Create the post
        print("\n[2/4] Creating LELI job post...")
        payload = {
            "title": TITLE,
            "content": CONTENT,
            "excerpt": EXCERPT,
            "status": "draft",
            "slug": SLUG,
            "acf": {"apply_job": ACF_APPLY_JOB},
        }

        resp = await wp._client.post(f"{wp._api_base}/job", json=payload)

        if resp.status_code in (200, 201):
            result = resp.json()
            post_id = result.get("id")
            print(f"  ID:      {post_id}")
            print(f"  Title:   {result.get('title', {}).get('rendered')}")
            print(f"  Status:  {result.get('status')}")
            print(f"  Slug:    {result.get('slug')}")
            print(f"  Link:    {result.get('link')}")
            content_len = len(result.get("content", {}).get("rendered", ""))
            print(f"  Content: {content_len} chars")
            acf = result.get("acf", {})
            apply_jobs = acf.get("apply_job", [])
            print(f"  ACF:     {len(apply_jobs)} locale entries")
            if apply_jobs:
                for entry in apply_jobs[:3]:
                    print(f"    - {entry.get('language')}: {entry.get('apply_url', '')[:60]}...")
                if len(apply_jobs) > 3:
                    print(f"    ... and {len(apply_jobs) - 3} more")
        else:
            print(f"  ERROR: {resp.status_code}")
            print(f"  {resp.text[:500]}")
            return

        # Step 3: Set taxonomies
        print("\n[3/4] Setting taxonomies...")
        if post_id:
            await wp._set_taxonomy(post_id, "job_type", JOB_TYPES, f"{wp._api_base}/job")
            print(f"  job_type: {JOB_TYPES}")
            await wp._set_taxonomy(post_id, "job_tag", JOB_TAGS, f"{wp._api_base}/job")
            print(f"  job_tag:  {JOB_TAGS}")

        # Step 4: Verify
        print(f"\n[4/4] Verifying...")
        verify = await wp._client.get(f"{wp._api_base}/job/{post_id}")
        if verify.status_code == 200:
            data = verify.json()
            print(f"  Title:   {data.get('title', {}).get('rendered')}")
            print(f"  Status:  {data.get('status')}")
            excerpt_r = data.get("excerpt", {}).get("rendered", "")
            print(f"  Excerpt: {excerpt_r[:150]}")
            acf = data.get("acf", {})
            print(f"  ACF:     {len(acf.get('apply_job', []))} locale entries")
            print(f"\n  Preview: {data.get('link')}")
        else:
            print(f"  Verify failed: {verify.status_code}")

    print("\n" + "=" * 60)
    print("POST SUMMARY:")
    print(f"  Title:    {TITLE}")
    print(f"  Slug:     {SLUG}")
    print(f"  Status:   DRAFT (review before publishing)")
    print(f"  Locales:  {len(ACF_APPLY_JOB)} language pairs")
    print(f"  Rates:    $0.012\u2013$0.033/word")
    print(f"  Type:     Translation (Language Quality Editing)")
    print(f"  Tags:     {', '.join(JOB_TAGS)}")
    print(f"  Note:     Russian (en_US-ru_RU) excluded \u2014 no application link")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
