"""Duplicate humus-twins → humus-siblings with reworked copy.

Fetches the original WP page, rewrites copy to remove "twin" language
and reposition around "Lookalike Siblings" (broader net), then creates
a new page at /humus-siblings/.

Uses the WP REST API with existing credentials.
"""
import asyncio
import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from wp_rest_client import WordPressClient


async def fetch_page_by_slug(wp: WordPressClient, slug: str) -> dict | None:
    """Fetch a WP page by its slug."""
    resp = await wp._client.get(
        f"{wp._api_base}/pages",
        params={"slug": slug, "per_page": 1},
    )
    if resp.status_code == 200:
        pages = resp.json()
        if pages:
            return pages[0]
    # Try posts too
    resp = await wp._client.get(
        f"{wp._api_base}/posts",
        params={"slug": slug, "per_page": 1},
    )
    if resp.status_code == 200:
        posts = resp.json()
        if posts:
            return posts[0]
    return None


def rewrite_copy(html: str) -> str:
    """Rewrite all twin-specific language to broader siblings positioning."""

    # --- Title / H1 level changes ---
    html = html.replace(
        "Twins &amp; Siblings AI Study",
        "Siblings AI Study"
    )
    html = html.replace(
        "Twins & Siblings AI Study",
        "Siblings AI Study"
    )
    html = html.replace(
        "Identical Twins &amp; Lookalike Siblings Needed",
        "Lookalike Siblings Needed"
    )
    html = html.replace(
        "Identical Twins & Lookalike Siblings Needed",
        "Lookalike Siblings Needed"
    )

    # --- Section headers ---
    html = html.replace(
        "THE ROLE OF TWINS IN AI",
        "THE ROLE OF SIBLINGS IN AI"
    )
    html = html.replace(
        "Why your resemblance matters to AI",
        "Why your resemblance matters to AI"
    )  # keep this one

    # --- Body copy rewrites ---
    html = html.replace(
        "Identical twins share genetics but develop unique vocal tones, expressions, and mannerisms. This controlled variation teaches AI to see what makes each person distinct.",
        "Siblings who look alike share strong genetic overlap yet develop unique vocal tones, expressions, and mannerisms. This natural variation teaches AI to see what makes each person distinct."
    )
    html = html.replace(
        "Same DNA, subtle differences",
        "Shared genetics, subtle differences"
    )

    # --- Compensation section ---
    html = html.replace(
        "$600 each &mdash; identical twins, all locations",
        "$600 each &mdash; all participants, all locations"
    )
    html = html.replace(
        "$600 each — identical twins, all locations",
        "$600 each — all participants, all locations"
    )
    html = html.replace(
        "per person — identical twins, all locations",
        "per person — all participants, all locations"
    )
    html = html.replace(
        "per person — identical twins",
        "per person — all participants"
    )
    html = html.replace(
        "Each participant receives their own $600. Both twins or siblings must complete the session together.",
        "Each participant receives their own $600. Both siblings must complete the session together."
    )

    # --- Eligibility section ---
    html = html.replace(
        "Identical twins or same-gender biological siblings who closely resemble each other",
        "Same-gender biological siblings who closely resemble each other"
    )
    html = html.replace(
        "you and your twin or sibling are eligible",
        "you and your sibling are eligible"
    )

    # --- FAQ section ---
    html = html.replace(
        "Do both twins/siblings need to participate?",
        "Do both siblings need to participate?"
    )
    html = html.replace(
        "Both twins or siblings must participate together",
        "Both siblings must participate together"
    )
    html = html.replace(
        "— $600 each for identical twins",
        "— $600 each"
    )
    html = html.replace(
        "Do siblings have to be the same age?",
        "Do siblings have to be the same age?"
    )  # keep

    # --- Generic twin → sibling replacements (case-sensitive, careful order) ---
    # "twin or sibling" → "sibling"
    html = html.replace("twin or sibling", "sibling")
    html = html.replace("Twin or Sibling", "Sibling")
    html = html.replace("twin/sibling", "sibling")

    # "twins or siblings" → "siblings"
    html = html.replace("twins or siblings", "siblings")
    html = html.replace("Twins or Siblings", "Siblings")
    html = html.replace("twins/siblings", "siblings")

    # "your twin or sibling" → "your sibling"
    html = html.replace("your twin or sibling", "your sibling")

    # "Both twins or siblings" → "Both siblings"
    html = html.replace("Both twins or siblings", "Both siblings")

    # "twins and siblings" → "siblings"
    html = html.replace("twins and siblings", "siblings")
    html = html.replace("Twins and Siblings", "Siblings")

    # Remaining standalone "twins" → "siblings" (but not in URLs or slugs)
    # Use regex to avoid replacing inside href/src attributes
    html = re.sub(r'(?<![/-])(?i)\btwins\b(?![/-])', lambda m: 'Siblings' if m.group()[0].isupper() else 'siblings', html)

    # Standalone "twin" → "sibling" (singular)
    html = re.sub(r'(?<![/-])(?i)\btwin\b(?![/-])', lambda m: 'Sibling' if m.group()[0].isupper() else 'sibling', html)

    # --- Meta / footer ---
    html = html.replace("Twins Study", "Siblings Study")

    # --- Fix any double-replacements ---
    html = html.replace("siblings siblings", "siblings")
    html = html.replace("Siblings Siblings", "Siblings")
    html = html.replace("sibling sibling", "sibling")

    return html


async def create_siblings_page(wp: WordPressClient, original: dict) -> dict:
    """Create the humus-siblings page from the original."""

    # Get the rendered content
    content_html = original.get("content", {}).get("rendered", "")
    title_raw = original.get("title", {}).get("rendered", "")

    if not content_html:
        raise ValueError("Original page has no content!")

    # Rewrite copy
    new_content = rewrite_copy(content_html)
    new_title = rewrite_copy(title_raw)

    # Also rewrite the excerpt if present
    excerpt_html = original.get("excerpt", {}).get("rendered", "")
    new_excerpt = rewrite_copy(excerpt_html) if excerpt_html else ""

    print(f"\n{'='*60}")
    print(f"ORIGINAL TITLE: {title_raw}")
    print(f"NEW TITLE:      {new_title}")
    print(f"{'='*60}")
    print(f"\nContent length: {len(content_html)} → {len(new_content)} chars")

    # Create the new page
    payload = {
        "title": new_title,
        "content": new_content,
        "status": "draft",  # Start as draft for review
        "slug": "humus-siblings",
    }
    if new_excerpt:
        payload["excerpt"] = new_excerpt

    # Copy over template if set
    if original.get("template"):
        payload["template"] = original["template"]

    # Copy featured image if set
    if original.get("featured_media"):
        payload["featured_media"] = original["featured_media"]

    resp = await wp._client.post(
        f"{wp._api_base}/pages",
        json=payload,
    )

    if resp.status_code in (200, 201):
        result = resp.json()
        print(f"\n✓ Page created!")
        print(f"  ID:      {result.get('id')}")
        print(f"  Slug:    {result.get('slug')}")
        print(f"  Status:  {result.get('status')}")
        print(f"  Link:    {result.get('link')}")
        return result
    else:
        # Try as post if page fails
        print(f"  Page creation returned {resp.status_code}, trying as post...")
        resp2 = await wp._client.post(
            f"{wp._api_base}/posts",
            json=payload,
        )
        if resp2.status_code in (200, 201):
            result = resp2.json()
            print(f"\n✓ Post created!")
            print(f"  ID:      {result.get('id')}")
            print(f"  Slug:    {result.get('slug')}")
            print(f"  Status:  {result.get('status')}")
            print(f"  Link:    {result.get('link')}")
            return result
        else:
            print(f"\n✗ Failed: {resp.status_code}")
            print(f"  Error: {resp.text[:500]}")
            print(f"  Post attempt: {resp2.status_code}")
            print(f"  Error: {resp2.text[:500]}")
            return {"error": resp.text}


async def main():
    print("=" * 60)
    print("HUMUS-TWINS → HUMUS-SIBLINGS DUPLICATOR")
    print("=" * 60)

    async with WordPressClient() as wp:
        # Step 1: Fetch the original page
        print("\n[1/3] Fetching humus-twins page...")
        original = await fetch_page_by_slug(wp, "humus-twins")

        if not original:
            print("✗ Could not find page with slug 'humus-twins'")
            print("  Trying alternative slugs...")
            for alt in ["humus-twins-2", "humus_twins", "twins"]:
                original = await fetch_page_by_slug(wp, alt)
                if original:
                    print(f"  Found at slug: {alt}")
                    break

        if not original:
            print("\n✗ FATAL: Cannot find the humus-twins page via WP REST API.")
            print("  The page may use a custom permalink structure or be a static file.")
            print("  Falling back to scraped content approach...")
            # We already have the content from the web fetch — use that
            return await create_from_scraped(wp)

        print(f"  ✓ Found: ID={original['id']}, type={original['type']}")
        print(f"  Title: {original.get('title', {}).get('rendered', 'N/A')}")
        print(f"  Template: {original.get('template', 'default')}")

        # Step 2: Check if humus-siblings already exists
        print("\n[2/3] Checking if humus-siblings already exists...")
        existing = await fetch_page_by_slug(wp, "humus-siblings")
        if existing:
            print(f"  ⚠ Page already exists: ID={existing['id']}")
            print(f"  Skipping creation. Delete it first if you want to recreate.")
            return

        # Step 3: Create the new page
        print("\n[3/3] Creating humus-siblings page...")
        result = await create_siblings_page(wp, original)

        if "error" not in result:
            print("\n" + "=" * 60)
            print("DONE! Page created as DRAFT.")
            print(f"Preview: {result.get('link', 'N/A')}")
            print("Publish it from WP admin when ready.")
            print("=" * 60)


async def create_from_scraped(wp: WordPressClient):
    """Fallback: create page from the scraped web content."""
    print("\n  Using scraped content from web fetch...")

    # The page content we fetched earlier — rebuild as HTML
    # This is a simplified version; the actual WP page likely has Elementor/block markup
    scraped_content = """
<!-- wp:heading {"level":1} -->
<h1>Lookalike Siblings Needed</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Join a paid video study helping AI understand real-world human variation. One guided session, onsite or from home, in select U.S. cities.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>$600 each</strong> · One 2–3 hour session · Select U.S. cities</p>
<!-- /wp:paragraph -->
"""

    print("  ⚠ Scraped fallback produces minimal content.")
    print("  For full page duplication, need WP REST API access to the original page.")
    print("  The page may be built with Elementor and stored differently.")

    # Still create a placeholder
    payload = {
        "title": "Siblings AI Study — $600 Each",
        "content": scraped_content,
        "status": "draft",
        "slug": "humus-siblings",
    }

    resp = await wp._client.post(f"{wp._api_base}/pages", json=payload)
    if resp.status_code in (200, 201):
        result = resp.json()
        print(f"\n  ✓ Placeholder page created: ID={result.get('id')}")
        print(f"  You'll need to copy the Elementor layout manually or use Elementor's duplicate feature.")
        return result
    else:
        print(f"\n  ✗ Failed: {resp.status_code} — {resp.text[:300]}")
        return {"error": resp.text}


if __name__ == "__main__":
    asyncio.run(main())
