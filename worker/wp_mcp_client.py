"""WordPress MCP client for Nova — auto-publish job posts.

Adapted from VYRA's WordPressMCPClient. Spawns `mcp-wordpress-remote`
via stdio, manages the MCP session, and exposes high-level methods
for creating job posts with taxonomies and custom meta fields.

Requires: pip install mcp
Requires: npx -y mcp-wordpress-remote (auto-installed on first use)
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

from config import WP_APP_PASSWORD, WP_SITE_URL, WP_USERNAME

logger = logging.getLogger(__name__)


def _parse_mcp_result(result: Any) -> dict:
    """Extract JSON from an MCP tool call result."""
    if hasattr(result, "content") and result.content:
        for block in result.content:
            if hasattr(block, "text"):
                try:
                    return json.loads(block.text)
                except json.JSONDecodeError:
                    return {"raw": block.text}
    return {}


class WordPressMCPClient:
    """Async context manager wrapping the WordPress MCP server.

    Usage:
        async with WordPressMCPClient() as wp:
            result = await wp.create_job_post(title="...", content="...", ...)
    """

    def __init__(
        self,
        site_url: str = "",
        username: str = "",
        app_password: str = "",
    ) -> None:
        self.command = "npx"
        self.args = ["-y", "@automattic/mcp-wordpress-remote"]
        self.extra_env: dict[str, str] = {}

        url = site_url or WP_SITE_URL
        user = username or WP_USERNAME
        pwd = app_password or WP_APP_PASSWORD

        if url:
            self.extra_env["WORDPRESS_SITE_URL"] = url
            self.extra_env["WPMCP_SITE_URL"] = url
        if user:
            self.extra_env["WORDPRESS_USERNAME"] = user
            self.extra_env["WPMCP_USERNAME"] = user
        if pwd:
            self.extra_env["WORDPRESS_APP_PASSWORD"] = pwd

        self._session: Any = None
        self._stdio_ctx: Any = None
        self._session_ctx: Any = None

    async def __aenter__(self) -> WordPressMCPClient:
        from mcp import ClientSession
        from mcp.client.stdio import StdioServerParameters, stdio_client

        env = dict(os.environ)
        env.update(self.extra_env)

        server_params = StdioServerParameters(
            command=self.command,
            args=self.args,
            env=env,
        )

        self._stdio_ctx = stdio_client(server_params)
        stdio_transport = await self._stdio_ctx.__aenter__()
        read_stream, write_stream = stdio_transport
        self._session_ctx = ClientSession(read_stream, write_stream)
        self._session = await self._session_ctx.__aenter__()
        await self._session.initialize()
        logger.info("WordPress MCP session initialized for %s", self.extra_env.get("WORDPRESS_SITE_URL", "unknown"))
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._session_ctx:
            await self._session_ctx.__aexit__(exc_type, exc_val, exc_tb)
        if self._stdio_ctx:
            await self._stdio_ctx.__aexit__(exc_type, exc_val, exc_tb)
        self._session = None

    async def _call_tool(self, tool_name: str, arguments: dict) -> dict:
        """Call an MCP tool and return parsed JSON."""
        if not self._session:
            raise RuntimeError("MCP session not initialized — use 'async with'")
        result = await self._session.call_tool(tool_name, arguments)
        return _parse_mcp_result(result)

    async def list_tools(self) -> list[str]:
        """List available tools on the MCP server."""
        if not self._session:
            raise RuntimeError("MCP session not initialized")
        result = await self._session.list_tools()
        return [t.name for t in result.tools] if hasattr(result, "tools") else []

    async def create_job_post(
        self,
        title: str,
        content: str,
        status: str = "publish",
        slug: str | None = None,
        meta: dict | None = None,
        job_types: list[str] | None = None,
        job_tags: list[str] | None = None,
    ) -> dict:
        """Create a WordPress job post with taxonomies and meta.

        Returns dict with at least {"id": int, "link": str}.
        """
        args: dict[str, Any] = {
            "title": title,
            "content": content,
            "status": status,
            "post_type": "job",
        }
        if slug:
            args["slug"] = slug
        if meta:
            args["meta"] = meta
        if job_types:
            args["job_types"] = job_types
        if job_tags:
            args["job_tags"] = job_tags

        result = await self._call_tool("create_page", args)
        wp_id = result.get("id") or result.get("page_id")
        wp_url = result.get("link") or result.get("url", "")
        logger.info("WP job post created: id=%s url=%s", wp_id, wp_url)
        return result
