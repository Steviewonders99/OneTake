"""WordPress REST API client — direct httpx, no MCP dependency.

Simpler and more reliable than the MCP approach. Calls the WP REST API
directly using Basic Auth with Application Password.

Supports custom post types (job), taxonomies (job_types, job_tags),
and custom meta fields (CPT | Job repeater fields).
"""
from __future__ import annotations

import base64
import logging
from typing import Any

import httpx
from config import WP_APP_PASSWORD, WP_SITE_URL, WP_USERNAME

logger = logging.getLogger(__name__)


class WordPressClient:
    """Direct WP REST API client using Basic Auth.

    Usage:
        async with WordPressClient() as wp:
            result = await wp.create_job_post(title="...", content="...", ...)
    """

    def __init__(
        self,
        site_url: str = "",
        username: str = "",
        app_password: str = "",
    ) -> None:
        self.site_url = (site_url or WP_SITE_URL).rstrip("/")
        self.username = username or WP_USERNAME
        self.password = app_password or WP_APP_PASSWORD
        self._client: httpx.AsyncClient | None = None

    @property
    def _auth_header(self) -> str:
        creds = f"{self.username}:{self.password}"
        encoded = base64.b64encode(creds.encode()).decode()
        return f"Basic {encoded}"

    @property
    def _api_base(self) -> str:
        return f"{self.site_url}/wp-json/wp/v2"

    async def __aenter__(self) -> WordPressClient:
        self._client = httpx.AsyncClient(
            timeout=30,
            headers={
                "Authorization": self._auth_header,
                "Content-Type": "application/json",
            },
        )
        # Verify connection
        resp = await self._client.get(f"{self._api_base}/users/me")
        if resp.status_code == 200:
            user = resp.json()
            logger.info("WP REST API connected as: %s (ID: %s)", user.get("name"), user.get("id"))
        else:
            logger.warning("WP auth check returned %d — proceeding anyway", resp.status_code)
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def create_job_post(
        self,
        title: str,
        content: str,
        status: str = "draft",
        slug: str | None = None,
        meta: dict | None = None,
        job_types: list[str] | None = None,
        job_tags: list[str] | None = None,
    ) -> dict:
        """Create a WordPress post (or custom post type 'job').

        Tries 'job' CPT first, falls back to regular 'posts' if 'job' type
        is not registered on the WP site.
        """
        if not self._client:
            raise RuntimeError("Client not initialized — use 'async with'")

        payload: dict[str, Any] = {
            "title": title,
            "content": content,
            "status": status,
        }
        if slug:
            payload["slug"] = slug
        if meta:
            payload["meta"] = meta

        # Try custom post type 'job' first
        endpoint = f"{self._api_base}/job"
        resp = await self._client.post(endpoint, json=payload)

        if resp.status_code == 404:
            # CPT 'job' not registered in REST API — fall back to regular posts
            logger.info("CPT 'job' not found — falling back to regular posts")
            endpoint = f"{self._api_base}/posts"
            resp = await self._client.post(endpoint, json=payload)

        if resp.status_code not in (200, 201):
            error_body = resp.text[:500]
            logger.error("WP create post failed (%d): %s", resp.status_code, error_body)
            raise RuntimeError(f"WP REST API error {resp.status_code}: {error_body}")

        result = resp.json()
        wp_id = result.get("id")
        wp_status = result.get("status", "draft")
        wp_slug = result.get("slug", "")
        raw_link = result.get("link", "")

        # Build the correct URL based on status
        if wp_status == "publish" and raw_link:
            # Published: use the clean permalink from WP
            wp_url = raw_link
        elif wp_slug:
            # Draft: construct the published URL (what it WILL be when live)
            wp_url = f"{self.site_url}/job/{wp_slug}/"
        else:
            wp_url = raw_link

        # Preview URL for drafts (always available)
        preview_url = (
            f"{self.site_url}/?post_type=job&p={wp_id}&preview=true"
            if wp_id
            else ""
        )

        logger.info(
            "WP post created: id=%s status=%s url=%s preview=%s",
            wp_id, wp_status, wp_url, preview_url,
        )

        # Set taxonomies if provided
        if job_types and wp_id:
            await self._set_taxonomy(wp_id, "job_types", job_types, endpoint)
        if job_tags and wp_id:
            await self._set_taxonomy(wp_id, "job_tags", job_tags, endpoint)

        return {
            "id": wp_id,
            "link": wp_url,
            "url": wp_url,
            "preview_url": preview_url,
            "status": wp_status,
            "slug": wp_slug,
        }

    async def _set_taxonomy(
        self,
        post_id: int,
        taxonomy: str,
        terms: list[str],
        post_endpoint: str,
    ) -> None:
        """Set taxonomy terms on a post. Creates terms if they don't exist."""
        if not self._client:
            return

        term_ids = []
        for term_name in terms:
            # Search for existing term
            search_resp = await self._client.get(
                f"{self._api_base}/{taxonomy}",
                params={"search": term_name, "per_page": 1},
            )

            if search_resp.status_code == 200:
                existing = search_resp.json()
                if existing:
                    term_ids.append(existing[0]["id"])
                    continue

            # Create new term
            create_resp = await self._client.post(
                f"{self._api_base}/{taxonomy}",
                json={"name": term_name},
            )
            if create_resp.status_code in (200, 201):
                term_ids.append(create_resp.json()["id"])
            else:
                logger.warning(
                    "Could not create taxonomy term '%s' in '%s': %d",
                    term_name, taxonomy, create_resp.status_code,
                )

        if term_ids:
            # Update post with term IDs
            await self._client.post(
                f"{post_endpoint}/{post_id}",
                json={taxonomy: term_ids},
            )
            logger.info("Set %s on post %d: %s", taxonomy, post_id, term_ids)
