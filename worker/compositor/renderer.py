"""Deterministic renderer -- CreativeConfig + photo URL -> complete HTML string.

Pure function with zero side effects. Calls the component registry to resolve
each layer to an HTML fragment, then passes all fragments to the layout
renderer which produces the final ``<!DOCTYPE html>`` document.
"""
from __future__ import annotations

from compositor.layouts import LAYOUT_RENDERERS
from compositor.registry import (
    get_actor_html,
    get_background_html,
    get_context_element_html,
    get_cta_html,
    get_overlay_html,
    get_text_block_html,
)
from compositor.schema import CreativeConfig


def assemble_html(
    config: CreativeConfig,
    actor_photo_url: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    """Assemble a complete HTML creative from a validated config.

    Parameters
    ----------
    config:
        Validated :class:`CreativeConfig` dataclass produced by the LLM
        Creative Director.
    actor_photo_url:
        Absolute URL (or base64 data-URI) for the actor photo.
    width:
        Canvas width in pixels (default 1080).
    height:
        Canvas height in pixels (default 1080).

    Returns
    -------
    str
        A self-contained HTML document ready for screenshot rendering.
    """
    # 1. Background layer
    background_html = get_background_html(
        config.background.type,
        config.background.preset,
        width,
        height,
    )

    # 2. Actor layer
    actor_html = get_actor_html(
        actor_photo_url,
        config.actor.position,
        config.actor.scale,
        config.actor.mask,
    )

    # 3. Overlay layer
    overlay_html = get_overlay_html(
        config.overlay.elements,
        config.overlay.intensity,
    )

    # 4. Text block layer
    text_html = get_text_block_html(
        config.text.headline,
        config.text.subheadline,
        config.text.position,
        config.text.size,
        config.text.contrast_backdrop,
    )

    # 5. CTA layer -- registry signature is (style, text, position)
    cta_html = get_cta_html(
        config.cta.style,
        config.cta.text,
        config.cta.position,
    )

    # 6. Context element layer (optional)
    context_html = ""
    if config.context_element is not None:
        context_html = get_context_element_html(
            config.context_element.type,
            config.context_element.position,
            config.context_element.content,
        )

    # 7. Look up layout renderer and produce the final document
    layout_render = LAYOUT_RENDERERS[config.layout]
    return layout_render(
        background_html=background_html,
        actor_html=actor_html,
        overlay_html=overlay_html,
        text_html=text_html,
        cta_html=cta_html,
        context_html=context_html,
        width=width,
        height=height,
    )
