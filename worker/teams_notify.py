"""Send Microsoft Teams notifications via Adaptive Card webhooks."""
from __future__ import annotations

import logging

import httpx
from config import APP_URL, TEAMS_WEBHOOK_URL

logger = logging.getLogger(__name__)


async def _send_card(card: dict) -> None:
    """Post an Adaptive Card to the configured Teams webhook.

    Silently logs errors instead of raising so that notification
    failures never block the pipeline.
    """
    if not TEAMS_WEBHOOK_URL:
        logger.debug("TEAMS_WEBHOOK_URL not set -- skipping notification.")
        return

    payload = {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": card,
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(TEAMS_WEBHOOK_URL, json=payload)
            resp.raise_for_status()
        logger.info("Teams notification sent.")
    except Exception as exc:
        logger.warning("Failed to send Teams notification: %s", exc)


async def notify_generation_complete(
    request_title: str,
    asset_count: int,
    request_id: str,
) -> None:
    """Notify Teams that creative generation finished successfully."""
    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
            {
                "type": "TextBlock",
                "text": "Creative Generation Complete",
                "weight": "Bolder",
                "size": "Medium",
                "color": "Good",
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Project", "value": request_title},
                    {"title": "Assets", "value": str(asset_count)},
                    {"title": "Status", "value": "Ready for Review"},
                ],
            },
        ],
        "actions": [
            {
                "type": "Action.OpenUrl",
                "title": "Review Creatives",
                "url": f"{APP_URL}/intake/{request_id}",
            }
        ],
    }
    await _send_card(card)


async def notify_generation_failed(
    request_title: str,
    error_message: str,
) -> None:
    """Notify Teams that creative generation failed."""
    card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
            {
                "type": "TextBlock",
                "text": "Creative Generation Failed",
                "weight": "Bolder",
                "size": "Medium",
                "color": "Attention",
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Project", "value": request_title},
                    {"title": "Error", "value": error_message[:300]},
                ],
            },
        ],
    }
    await _send_card(card)
