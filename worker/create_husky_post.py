"""Create Husky job post — paid audio discussion for native speakers.

Project: Husky (Moderator) — Audio data collection
Format: 3-person recorded group discussions (podcast-style)
Locales: 13 languages, $32-40/hr, remote

Run: python3 create_husky_post.py
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from wp_rest_client import WordPressClient

# ─── Post Data ───────────────────────────────────────────────────────────────

TITLE = "Join a Recorded Discussion in Your Native Language — Help Train AI Speech Models"

SLUG = "husky"

EXCERPT = (
    "Join a small group of native speakers for a natural, podcast-style audio "
    "discussion. 30-minute remote sessions, $32–$40/hr depending on language. "
    "Your authentic conversation helps AI understand real human speech."
)

ACF_APPLY_JOB = [
    {"language": "Danish (Denmark)", "apply_url": "https://my.oneforma.com/crowd/jobs/11964?from=list&tab=all"},
    {"language": "Dutch (Netherlands)", "apply_url": "https://my.oneforma.com/crowd/jobs/11948?from=list&tab=all"},
    {"language": "English (Ireland)", "apply_url": "https://my.oneforma.com/crowd/jobs/11958?from=list&tab=all"},
    {"language": "English (United Kingdom)", "apply_url": "https://my.oneforma.com/crowd/jobs/11894?from=list&tab=all"},
    {"language": "Finnish (Finland)", "apply_url": "https://my.oneforma.com/crowd/jobs/11966?from=list&tab=all"},
    {"language": "French (Belgium)", "apply_url": "https://my.oneforma.com/crowd/jobs/11962?from=list&tab=all"},
    {"language": "French (Canada)", "apply_url": "https://my.oneforma.com/crowd/jobs/11954?from=list&tab=all"},
    {"language": "French (France)", "apply_url": "https://my.oneforma.com/crowd/jobs/11950?from=list&tab=all"},
    {"language": "German (Austria)", "apply_url": "https://my.oneforma.com/crowd/jobs/11960?from=list&tab=all"},
    {"language": "German (Germany)", "apply_url": "https://my.oneforma.com/crowd/jobs/11946?from=list&tab=all"},
    {"language": "German (Switzerland)", "apply_url": "https://my.oneforma.com/crowd/jobs/11956?from=list&tab=all"},
    {"language": "Norwegian Bokmal", "apply_url": "https://my.oneforma.com/crowd/jobs/12021?from=list&tab=all"},
    {"language": "Spanish (Spain)", "apply_url": "https://my.oneforma.com/crowd/jobs/11952?from=list&tab=all"},
]

CONTENT = """\
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Your native language is exactly what AI is missing</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>AI speech and language models learn from real conversations — not scripts, not recordings of single speakers reading prompts. They need authentic, multi-speaker discussions with natural turn-taking, interruptions, laughter, and the rhythm of how people actually talk.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>That's where your native fluency comes in.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>You'll join a small group of 3 native speakers for a natural, unscripted audio discussion — similar to a podcast or talk show episode — on everyday topics provided in advance. Sessions are 30 minutes, fully remote, and paid hourly.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What you'll do</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>Join a <strong>30-minute recorded audio session</strong> online with 2 other native speakers</li>
<li>Discuss provided topics in a <strong>natural, unscripted way</strong> — no reading from a script</li>
<li>One speaker acts as the <strong>moderator/host</strong>, guiding the conversation and engaging the group</li>
<li>The remaining speakers participate as <strong>guests</strong>, sharing their thoughts naturally and conversationally</li>
<li>The conversation should feel like a <strong>real podcast or talk show</strong> — casual, engaging, and authentic</li>
<li>Submit a <strong>brief episode summary</strong> after the session</li>
</ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>You'll participate in <strong>3 to 5 sessions</strong> total, scheduled at times that work for you.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Why this matters</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Your natural conversation — the way you switch topics, react to others, and express yourself in your native language — helps train AI systems to understand real human speech. This project contributes to making speech recognition and language models work better across languages, dialects, and real-world speaking styles.</p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Compensation</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Hourly pay varies by language. Payment is based on approved assets.</p>
<!-- /wp:paragraph -->

<!-- wp:table -->
<figure class="wp-block-table"><table><thead><tr><th>Language</th><th>Hourly Rate</th></tr></thead><tbody><tr><td>Danish, Dutch, English (Ireland), Finnish, French (Canada), Norwegian</td><td><strong>$40/hr</strong></td></tr><tr><td>French (Belgium), German (Austria, Germany, Switzerland)</td><td><strong>$35/hr</strong></td></tr><tr><td>English (UK), French (France), Spanish (Spain)</td><td><strong>$32/hr</strong></td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:paragraph -->
<p><strong>Select your language below to apply.</strong></p>
<!-- /wp:paragraph -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">How it works</h2>
<!-- /wp:heading -->

<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list">
<li><strong>Apply</strong> — select your language and confirm your eligibility</li>
<li><strong>Get matched</strong> — you'll be grouped with 2 other native speakers</li>
<li><strong>Review your topics</strong> — receive everyday discussion topics in advance</li>
<li><strong>Join the session</strong> — connect online for a 30-minute recorded discussion</li>
<li><strong>Submit your summary</strong> — provide a brief episode recap after the session</li>
<li><strong>Get paid</strong> — receive payment for approved recordings</li>
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
<li>Are a <strong>native speaker</strong> of one of the listed languages</li>
<li>Are comfortable speaking naturally and spontaneously on everyday topics</li>
<li>Are available for <strong>scheduled 30-minute sessions</strong> (3–5 sessions total)</li>
<li>Have a reliable internet connection and a <strong>quiet recording environment</strong></li>
<li>Have a device with a microphone — headset preferred</li>
</ul>
<!-- /wp:list -->

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">What you'll need</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>A device with a microphone (headset preferred for best audio quality)</li>
<li>A quiet recording environment</li>
<li>Reliable internet connection</li>
<li>Availability for 3–5 scheduled sessions</li>
</ul>
<!-- /wp:list -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:paragraph -->
<p><strong>Ready to put your native language to work?</strong> Select your language below and apply to join.</p>
<!-- /wp:paragraph -->
"""


async def main():
    print("=" * 60)
    print("HUSKY JOB POST — CREATE")
    print("=" * 60)

    async with WordPressClient() as wp:
        # Step 1: Check if slug already exists
        print("\n[1/3] Checking if 'husky' slug exists...")
        resp = await wp._client.get(
            f"{wp._api_base}/job",
            params={"slug": SLUG, "per_page": 1},
        )
        if resp.status_code == 200 and resp.json():
            existing = resp.json()[0]
            print(f"  Post already exists: ID={existing['id']}, status={existing['status']}")
            print(f"  Link: {existing.get('link')}")
            print(f"\n  Updating existing post instead...")
            # Update instead of create
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
                result = update_resp.json()
                print(f"  Updated: ID={result['id']}")
                print(f"  Title:   {result.get('title', {}).get('rendered')}")
                print(f"  Link:    {result.get('link')}")
            else:
                print(f"  ERROR: {update_resp.status_code} — {update_resp.text[:500]}")
            return

        # Step 2: Create the post
        print("\n[2/3] Creating Husky job post...")
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
            print(f"  ID:      {result.get('id')}")
            print(f"  Title:   {result.get('title', {}).get('rendered')}")
            print(f"  Status:  {result.get('status')}")
            print(f"  Slug:    {result.get('slug')}")
            print(f"  Link:    {result.get('link')}")
            content_len = len(result.get("content", {}).get("rendered", ""))
            print(f"  Content: {content_len} chars")

            # Check ACF fields
            acf = result.get("acf", {})
            apply_jobs = acf.get("apply_job", [])
            print(f"  ACF apply_job: {len(apply_jobs)} entries")
            if apply_jobs:
                for entry in apply_jobs[:3]:
                    print(f"    - {entry.get('language')}: {entry.get('apply_url', '')[:60]}...")
                if len(apply_jobs) > 3:
                    print(f"    ... and {len(apply_jobs) - 3} more")
        else:
            print(f"  ERROR: {resp.status_code}")
            print(f"  {resp.text[:500]}")
            return

        # Step 3: Verify
        print("\n[3/3] Verifying...")
        post_id = result.get("id")
        verify = await wp._client.get(f"{wp._api_base}/job/{post_id}")
        if verify.status_code == 200:
            data = verify.json()
            print(f"  Title:   {data.get('title', {}).get('rendered')}")
            print(f"  Status:  {data.get('status')}")
            excerpt = data.get("excerpt", {}).get("rendered", "")
            print(f"  Excerpt: {excerpt[:150]}")
            acf = data.get("acf", {})
            print(f"  ACF:     {len(acf.get('apply_job', []))} locale entries")
            print(f"\n  Preview: {data.get('link')}")
        else:
            print(f"  Verify failed: {verify.status_code}")

    print("\n" + "=" * 60)
    print("POST SUMMARY:")
    print(f"  Title: {TITLE}")
    print(f"  Slug:  {SLUG}")
    print(f"  Status: DRAFT (review before publishing)")
    print(f"  Locales: 13 languages")
    print(f"  Rates: $32-40/hr by language")
    print(f"  Format: 30-min group audio discussions, 3-5 sessions")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
