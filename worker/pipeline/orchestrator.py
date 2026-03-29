"""Pipeline orchestrator -- runs stages 1-4 sequentially.

Handles full generation and single-stage regeneration. Each stage
receives a shared *context* dict that accumulates results. On failure
the request is returned to 'draft' status and Teams is notified.
"""
from __future__ import annotations

import logging

from neon_client import get_actors, update_request_status
from pipeline.stage1_intelligence import run_stage1
from pipeline.stage2_images import run_stage2
from pipeline.stage3_copy import run_stage3
from pipeline.stage4_compose_v2 import run_stage4
from pipeline.stage_video import run_video_stage
from teams_notify import notify_generation_complete, notify_generation_failed

logger = logging.getLogger(__name__)


async def run_pipeline(job: dict) -> None:
    """Run the full Creative OS pipeline for a compute job.

    Parameters
    ----------
    job:
        A dict from ``fetch_pending_jobs`` containing at minimum
        ``request_id``, ``job_type``, and optionally ``stage_target``
        and ``feedback``.
    """
    request_id: str = job["request_id"]
    job_type: str = job["job_type"]
    stage_target = job.get("stage_target")
    feedback = job.get("feedback")

    stages = [
        (1, "Strategic Intelligence", run_stage1),
        (2, "Character-Driven Image Generation", run_stage2),
        (3, "Copy Generation", run_stage3),
        (4, "Layout Composition", run_stage4),
        (5, "Video Generation", run_video_stage),
    ]

    # If regenerating a specific stage, only run that one.
    if job_type == "regenerate_stage" and stage_target is not None:
        target = int(stage_target)
        stages = [(n, name, fn) for n, name, fn in stages if n == target]

    context: dict = {
        "request_id": request_id,
        "feedback": feedback,
    }

    # Check if Stage 1 already completed (brief exists in Neon) — skip if so
    if stages and stages[0][0] == 1:
        try:
            from neon_client import get_brief, get_intake_request
            existing_brief = await get_brief(request_id)
            if existing_brief:
                import json
                brief_data = existing_brief.get("brief_data")
                if isinstance(brief_data, str):
                    brief_data = json.loads(brief_data)
                if brief_data and "campaign_objective" in brief_data:
                    request = await get_intake_request(request_id)
                    context.update({
                        "request_title": request.get("title", "Untitled"),
                        "brief": brief_data,
                        "personas": brief_data.get("personas", []),
                        "cultural_research": brief_data.get("cultural_research", {}),
                        "design_direction": existing_brief.get("design_direction", {}),
                        "target_languages": request.get("target_languages", []),
                        "target_regions": request.get("target_regions", []),
                        "form_data": request.get("form_data", {}),
                    })
                    logger.info("SKIPPING Stage 1 — brief already exists in Neon (campaign: %s)", brief_data.get("campaign_objective", "")[:80])
                    stages = [(n, name, fn) for n, name, fn in stages if n > 1]
        except Exception as e:
            logger.info("Could not check for existing brief: %s — running Stage 1", e)

    for stage_num, stage_name, stage_fn in stages:
        logger.info("Running Stage %d: %s", stage_num, stage_name)

        # Stage 5 (Video) needs actors in context — load from Neon
        if stage_num == 5 and "actors" not in context:
            try:
                actors = await get_actors(request_id)
                context["actors"] = actors
                logger.info("Loaded %d actors from Neon for video stage", len(actors))
            except Exception as e:
                logger.warning("Could not load actors for video: %s", e)
                context["actors"] = []

        try:
            result = await stage_fn(context)
            context.update(result)  # each stage can pass data to the next
            logger.info("Stage %d passed.", stage_num)
        except Exception as exc:
            logger.error("Stage %d failed: %s", stage_num, exc, exc_info=True)
            await update_request_status(request_id, "draft")
            await notify_generation_failed(
                context.get("request_title", "Unknown"),
                str(exc),
            )
            raise

    # All stages passed.
    await update_request_status(request_id, "review")
    await notify_generation_complete(
        context.get("request_title", "Unknown"),
        context.get("asset_count", 0),
        request_id,
    )
