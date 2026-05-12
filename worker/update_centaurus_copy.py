"""Update Centaurus job post (178019) with optimized copy.

Rewrites the bare-bones listing into a full, brand-aligned landing page
following OneForma voice rules (Expertise First, Purposeful Not Transactional,
Human First, Specific Not Vague).

Run: python3 update_centaurus_copy.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from wp_rest_client import WordPressClient

# ─── Optimized Copy ──────────────────────────────────────────────────────────

NEW_TITLE = "Record Short Videos at Home — Help Build More Inclusive AI"

NEW_EXCERPT = (
    "Record 4 short selfie videos using your Apple device and earn a "
    "country-based reward. Your real-world recordings help AI represent "
    "real people more accurately. Under 10 minutes, no experience needed."
)

NEW_CONTENT = """\
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Your everyday world is exactly what AI needs</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>AI systems need to understand real people in real environments — different faces, different ages, different settings. Your Apple device and a few minutes of your time can help make that happen.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Record 4 short selfie-style videos (about 15 seconds each) following simple step-by-step instructions. Two indoors, two outdoors. The whole task takes under 10 minutes.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>No prior experience required. No resume. No interview.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Why your contribution matters</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Your recordings help AI systems understand what real people look like in real environments — across age groups, appearances, and everyday settings. This project supports more accurate, inclusive AI development using authentic video data from people around the world.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Participation is voluntary, and you can withdraw at any time.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What you'll record</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>2 videos indoors</strong> — natural, everyday settings</li>
<li><strong>2 videos outdoors</strong> — regular environments around you</li>
</ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>Each video is about 15 seconds long. You'll receive clear, guided instructions before you start.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Compensation</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Rewards vary by country and are paid per approved task completion via <strong>Tremendous virtual payment card</strong>.</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list">
<li><strong>Payment timing:</strong> Within 5–7 business days after approval</li>
<li><strong>Payment method:</strong> Tremendous virtual card</li>
<li><strong>Usage:</strong> Spend your virtual card however you wish, depending on options available in your country</li>
</ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p><strong>Check your country's reward using the dropdown below.</strong></p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">How it works</h2>
<!-- /wp:heading -->

<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list">
<li><strong>Apply</strong> — confirm your eligibility through the form below</li>
<li><strong>Complete the survey</strong> — share the required participant details</li>
<li><strong>Get your instructions</strong> — receive clear recording guidelines</li>
<li><strong>Record your videos</strong> — capture 2 indoor and 2 outdoor selfie-style clips</li>
<li><strong>Submit</strong> — upload your videos for review</li>
<li><strong>Get paid</strong> — receive your Tremendous virtual card within 5–7 business days</li>
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
<li>Live in one of the eligible countries (check the dropdown above)</li>
<li>Have an iPhone, iPad, or Mac — most models qualify</li>
<li>Can follow simple written instructions</li>
<li>Are comfortable recording short selfie-style videos</li>
<li>Have parent or guardian consent if required</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What you'll need</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>An Apple device — iPhone, iPad, or Mac</li>
<li>A few minutes to complete the recording</li>
<li>Internet access to upload your videos</li>
</ul>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:paragraph -->
<p><strong>Ready to contribute?</strong> Select your country below and apply to get started.</p>
<!-- /wp:paragraph -->
"""


async def main():
    print("=" * 60)
    print("CENTAURUS JOB POST — COPY OPTIMIZATION")
    print("=" * 60)

    async with WordPressClient() as wp:
        # Step 1: Verify current state
        print("\n[1/3] Fetching current post 178019...")
        resp = await wp._client.get(f"{wp._api_base}/job/178019")
        if resp.status_code != 200:
            print(f"  ERROR: {resp.status_code} — {resp.text[:300]}")
            return

        current = resp.json()
        print(f"  Title:   {current.get('title', {}).get('rendered')}")
        print(f"  Status:  {current.get('status')}")
        old_content = current.get("content", {}).get("rendered", "")
        print(f"  Content: {len(old_content)} chars")

        # Step 2: Update the post
        print("\n[2/3] Updating post with optimized copy...")
        payload = {
            "title": NEW_TITLE,
            "content": NEW_CONTENT,
            "excerpt": NEW_EXCERPT,
        }

        resp = await wp._client.post(
            f"{wp._api_base}/job/178019",
            json=payload,
        )

        if resp.status_code in (200, 201):
            result = resp.json()
            print(f"  Title:   {result.get('title', {}).get('rendered')}")
            print(f"  Status:  {result.get('status')}")
            new_content = result.get("content", {}).get("rendered", "")
            print(f"  Content: {len(new_content)} chars (was {len(old_content)})")
            print(f"  Link:    {result.get('link')}")
        else:
            print(f"  ERROR: {resp.status_code}")
            print(f"  {resp.text[:500]}")
            return

        # Step 3: Verify
        print("\n[3/3] Verifying update...")
        verify = await wp._client.get(f"{wp._api_base}/job/178019")
        if verify.status_code == 200:
            data = verify.json()
            print(f"  Title:   {data.get('title', {}).get('rendered')}")
            print(f"  Excerpt: {data.get('excerpt', {}).get('rendered', '')[:150]}")
            print(f"  Content: {len(data.get('content', {}).get('rendered', ''))} chars")
            print(f"\n  DONE. Live at: {data.get('link')}")
        else:
            print(f"  Verify failed: {verify.status_code}")

    print("\n" + "=" * 60)
    print("CHANGES SUMMARY:")
    print("  - Title: 'Centaurus' → purpose-led headline")
    print("  - Content: bare-bones 1.6K → full landing page 4K+ chars")
    print("  - Excerpt: added SEO-friendly meta description")
    print("  - Structure: purpose FIRST, compensation SUPPORTING")
    print("  - Voice: aligned with OneForma Earn pillar")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
