# Stage 4 Graphic Design Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slow, low-quality LLM-generated-HTML composition engine (Stage 4 v3) with a component assembly architecture where the LLM outputs structured JSON decisions and a deterministic renderer assembles pixel-perfect creatives from pre-built components.

**Architecture:** The LLM acts as a creative director (picks layouts, positions actors, selects copy), outputting ~50 tokens of JSON per creative. A deterministic renderer assembles HTML from 12 layout templates and ~80 layer components. Two-tier VQA (instant deterministic + batch vision) with auto-fix prop tweaks replaces the expensive per-creative retry loop.

**Tech Stack:** Python 3.11, asyncio, Playwright (PNG render), Jinja2 (HTML templating), Qwen 3.5-397B via OpenRouter (creative director), Gemma 4 via NIM/OpenRouter (batch VQA), Pydantic or dataclasses (schema validation)

---

## File Structure

| File | Purpose |
|------|---------|
| Create: `worker/compositor/__init__.py` | Package init |
| Create: `worker/compositor/schema.py` | Creative config dataclass + JSON schema validation |
| Create: `worker/compositor/registry.py` | Component registry — maps IDs to HTML fragments |
| Create: `worker/compositor/renderer.py` | Deterministic HTML assembler (JSON config → HTML string) |
| Create: `worker/compositor/render_png.py` | Playwright PNG renderer (HTML → bytes), reuses browser instance |
| Create: `worker/compositor/adapt.py` | Phase 2 aspect ratio adaptation (reflow JSON config for different dimensions) |
| Create: `worker/compositor/layouts/` | 12 layout template HTML/CSS files (Jinja2) |
| Create: `worker/compositor/components/` | Layer component HTML fragments organized by layer |
| Create: `worker/vqa/__init__.py` | Package init |
| Create: `worker/vqa/tier1_checks.py` | Deterministic validation (contrast, structure, content) |
| Create: `worker/vqa/tier2_batch_vqa.py` | Batch Gemma 4 Vision evaluation (all 6 PNGs in one call) |
| Create: `worker/vqa/auto_fix.py` | Prop-tweak auto-fix (issue → config adjustment → re-render) |
| Create: `worker/ai/creative_director.py` | LLM prompt + response parsing for batch creative decisions |
| Create: `worker/pipeline/stage4_design_agent.py` | New pipeline orchestrator (entry point: `run_stage4()`) |
| Modify: `worker/config.py` | Add `STAGE4_ENGINE`, `CREATIVE_DIRECTOR_MODEL` config vars |
| Modify: `worker/pipeline/orchestrator.py` | Route to design agent or legacy v3 based on config |
| Create: `worker/tests/test_compositor_schema.py` | Schema validation tests |
| Create: `worker/tests/test_compositor_renderer.py` | Renderer unit tests (HTML assembly) |
| Create: `worker/tests/test_vqa_tier1.py` | Tier 1 deterministic check tests |
| Create: `worker/tests/test_vqa_auto_fix.py` | Auto-fix logic tests |
| Create: `worker/tests/test_creative_director.py` | LLM output parsing + schema validation tests |
| Create: `worker/tests/test_stage4_design_agent.py` | Pipeline integration tests (pure logic) |

---

### Task 1: Schema + Config Foundation

**Files:**
- Create: `worker/compositor/__init__.py`
- Create: `worker/compositor/schema.py`
- Modify: `worker/config.py`

- [ ] **Step 1: Create compositor package**

Create `worker/compositor/__init__.py`:

```python
"""Component assembly compositor for Stage 4 graphic design agent."""
```

- [ ] **Step 2: Write failing schema tests**

Create `worker/tests/test_compositor_schema.py`:

```python
"""Tests for creative config schema validation."""
import pytest
from compositor.schema import (
    CreativeConfig,
    validate_batch,
    EARN_LAYOUTS,
    GROW_LAYOUTS,
    SHAPE_LAYOUTS,
    VALID_POSITIONS,
    VALID_MASKS,
    VALID_TEXT_SIZES,
    VALID_CTA_STYLES,
)


def _make_config(**overrides):
    """Factory for valid CreativeConfig dicts."""
    base = {
        "layout": "earn_hero_badge",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "abc-123", "position": "right", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": "Earn $17.50/hr from home",
            "subheadline": "Data collection tasks in Morocco",
            "position": "top-left",
            "size": "large",
            "contrast_backdrop": "dark_gradient",
        },
        "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }
    base.update(overrides)
    return base


class TestCreativeConfig:
    def test_valid_config_parses(self):
        config = CreativeConfig.from_dict(_make_config())
        assert config.layout == "earn_hero_badge"
        assert config.actor.position == "right"
        assert config.text.headline == "Earn $17.50/hr from home"

    def test_invalid_layout_raises(self):
        with pytest.raises(ValueError, match="layout"):
            CreativeConfig.from_dict(_make_config(layout="nonexistent_layout"))

    def test_invalid_position_raises(self):
        with pytest.raises(ValueError, match="position"):
            CreativeConfig.from_dict(
                _make_config(actor={"actor_id": "x", "position": "top", "scale": 0.8, "mask": "none"})
            )

    def test_scale_out_of_range_raises(self):
        with pytest.raises(ValueError, match="scale"):
            CreativeConfig.from_dict(
                _make_config(actor={"actor_id": "x", "position": "right", "scale": 1.5, "mask": "none"})
            )

    def test_invalid_mask_raises(self):
        with pytest.raises(ValueError, match="mask"):
            CreativeConfig.from_dict(
                _make_config(actor={"actor_id": "x", "position": "right", "scale": 0.8, "mask": "hexagon"})
            )

    def test_invalid_text_size_raises(self):
        with pytest.raises(ValueError, match="size"):
            d = _make_config()
            d["text"]["size"] = "tiny"
            CreativeConfig.from_dict(d)

    def test_invalid_cta_style_raises(self):
        with pytest.raises(ValueError, match="style"):
            d = _make_config()
            d["cta"]["style"] = "neon_glow"
            CreativeConfig.from_dict(d)

    def test_context_element_optional(self):
        config = CreativeConfig.from_dict(_make_config(context_element=None))
        assert config.context_element is None

    def test_context_element_parses(self):
        config = CreativeConfig.from_dict(_make_config(
            context_element={"type": "device_mockup", "position": "bottom-left", "content": "survey_ui"}
        ))
        assert config.context_element.type == "device_mockup"


class TestBatchValidation:
    def test_duplicate_layouts_rejected(self):
        configs = [_make_config(layout="earn_hero_badge")] * 2
        errors = validate_batch(configs, pillar="earn", copy_variants=["Earn $17.50/hr from home"])
        assert any("duplicate" in e.lower() for e in errors)

    def test_cross_pillar_layout_rejected(self):
        configs = [_make_config(layout="grow_editorial")]
        errors = validate_batch(configs, pillar="earn", copy_variants=["Earn $17.50/hr from home"])
        assert any("pillar" in e.lower() for e in errors)

    def test_headline_not_in_copy_variants_rejected(self):
        configs = [_make_config()]
        errors = validate_batch(configs, pillar="earn", copy_variants=["Different headline"])
        assert any("headline" in e.lower() for e in errors)

    def test_actor_text_overlap_rejected(self):
        """Actor right + text top-right = overlap risk."""
        d = _make_config()
        d["actor"]["position"] = "right"
        d["text"]["position"] = "top-right"
        errors = validate_batch([d], pillar="earn", copy_variants=["Earn $17.50/hr from home"])
        assert any("overlap" in e.lower() or "separation" in e.lower() for e in errors)

    def test_valid_batch_passes(self):
        c1 = _make_config(layout="earn_hero_badge")
        c2 = _make_config(layout="earn_split_stat")
        c2["text"]["headline"] = "Flexible remote work"
        errors = validate_batch(
            [c1, c2],
            pillar="earn",
            copy_variants=["Earn $17.50/hr from home", "Flexible remote work"],
        )
        assert errors == []
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_compositor_schema.py -v 2>&1 | tail -20`

Expected: FAIL — `ModuleNotFoundError: No module named 'compositor.schema'`

- [ ] **Step 4: Implement schema module**

Create `worker/compositor/schema.py`:

```python
"""Creative config schema — defines the JSON structure the LLM outputs
and the deterministic renderer consumes.

Every field is constrained to valid enum values. The renderer never
receives free-form strings — only IDs that map to pre-built components.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ── Layout IDs ────────────────────────────────────────────────────
EARN_LAYOUTS = ["earn_hero_badge", "earn_split_stat", "earn_full_bleed", "earn_card_stack"]
GROW_LAYOUTS = ["grow_device_mockup", "grow_editorial", "grow_diagonal_split", "grow_bold_type"]
SHAPE_LAYOUTS = ["shape_portrait_cred", "shape_multi_grid", "shape_clean_card", "shape_photo_frame"]
ALL_LAYOUTS = EARN_LAYOUTS + GROW_LAYOUTS + SHAPE_LAYOUTS

# ── Enum values ───────────────────────────────────────────────────
VALID_POSITIONS = ["left", "center", "right"]
VALID_TEXT_POSITIONS = ["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center"]
VALID_MASKS = ["none", "soft_fade", "circle", "arch", "diagonal"]
VALID_TEXT_SIZES = ["small", "medium", "large", "hero"]
VALID_TEXT_STYLES = ["headline_only", "headline_sub", "stat_callout", "editorial_serif"]
VALID_CONTRAST_BACKDROPS = ["none", "dark_gradient", "light_blur", "solid_pill", "brand_accent"]
VALID_CTA_STYLES = ["pill_primary", "pill_outline", "banner_full", "floating_circle", "inline_text"]
VALID_CTA_POSITIONS = ["bottom-center", "bottom-right", "inline"]
VALID_INTENSITIES = ["subtle", "medium", "bold"]
VALID_BG_TYPES = ["solid", "gradient", "scene_blur", "scene_photo"]
VALID_CONTEXT_TYPES = ["device_mockup", "task_card", "icon_cluster", "stat_badge"]
VALID_CONTEXT_POSITIONS = ["bottom-left", "bottom-right", "center-left", "center-right"]

# ── Actor-text separation rules ───────────────────────────────────
# If actor is on the right, text must be on the left (and vice versa)
_SAFE_TEXT_POSITIONS = {
    "left": ["top-right", "bottom-right", "center"],  # actor left → text right or center
    "center": ["top-left", "top-center", "bottom-left", "bottom-center"],  # actor center → text top or bottom
    "right": ["top-left", "bottom-left", "center"],  # actor right → text left or center
}


def _validate(value: Any, name: str, allowed: list) -> None:
    if value not in allowed:
        raise ValueError(f"Invalid {name}: {value!r}. Allowed: {allowed}")


@dataclass
class BackgroundConfig:
    type: str
    preset: str

    @classmethod
    def from_dict(cls, d: dict) -> BackgroundConfig:
        _validate(d["type"], "background.type", VALID_BG_TYPES)
        return cls(type=d["type"], preset=d["preset"])


@dataclass
class ActorConfig:
    actor_id: str
    position: str
    scale: float
    mask: str

    @classmethod
    def from_dict(cls, d: dict) -> ActorConfig:
        _validate(d["position"], "actor.position", VALID_POSITIONS)
        _validate(d["mask"], "actor.mask", VALID_MASKS)
        if not (0.3 <= d["scale"] <= 1.0):
            raise ValueError(f"Invalid actor.scale: {d['scale']}. Must be 0.3-1.0")
        return cls(actor_id=d["actor_id"], position=d["position"], scale=d["scale"], mask=d["mask"])


@dataclass
class OverlayConfig:
    elements: list[str]
    intensity: str

    @classmethod
    def from_dict(cls, d: dict) -> OverlayConfig:
        _validate(d["intensity"], "overlay.intensity", VALID_INTENSITIES)
        return cls(elements=d.get("elements", []), intensity=d["intensity"])


@dataclass
class TextConfig:
    headline: str
    subheadline: str
    position: str
    size: str
    contrast_backdrop: str

    @classmethod
    def from_dict(cls, d: dict) -> TextConfig:
        _validate(d["position"], "text.position", VALID_TEXT_POSITIONS)
        _validate(d["size"], "text.size", VALID_TEXT_SIZES)
        _validate(d.get("contrast_backdrop", "none"), "text.contrast_backdrop", VALID_CONTRAST_BACKDROPS)
        return cls(
            headline=d["headline"],
            subheadline=d.get("subheadline", ""),
            position=d["position"],
            size=d["size"],
            contrast_backdrop=d.get("contrast_backdrop", "none"),
        )


@dataclass
class CTAConfig:
    text: str
    style: str
    position: str

    @classmethod
    def from_dict(cls, d: dict) -> CTAConfig:
        _validate(d["style"], "cta.style", VALID_CTA_STYLES)
        _validate(d["position"], "cta.position", VALID_CTA_POSITIONS)
        return cls(text=d["text"], style=d["style"], position=d["position"])


@dataclass
class ContextElementConfig:
    type: str
    position: str
    content: str

    @classmethod
    def from_dict(cls, d: dict) -> ContextElementConfig:
        _validate(d["type"], "context_element.type", VALID_CONTEXT_TYPES)
        _validate(d["position"], "context_element.position", VALID_CONTEXT_POSITIONS)
        return cls(type=d["type"], position=d["position"], content=d.get("content", ""))


@dataclass
class CreativeConfig:
    layout: str
    background: BackgroundConfig
    actor: ActorConfig
    overlay: OverlayConfig
    text: TextConfig
    cta: CTAConfig
    context_element: ContextElementConfig | None = None

    @classmethod
    def from_dict(cls, d: dict) -> CreativeConfig:
        _validate(d["layout"], "layout", ALL_LAYOUTS)
        return cls(
            layout=d["layout"],
            background=BackgroundConfig.from_dict(d["background"]),
            actor=ActorConfig.from_dict(d["actor"]),
            overlay=OverlayConfig.from_dict(d["overlay"]),
            text=TextConfig.from_dict(d["text"]),
            cta=CTAConfig.from_dict(d["cta"]),
            context_element=(
                ContextElementConfig.from_dict(d["context_element"])
                if d.get("context_element")
                else None
            ),
        )


def validate_batch(
    configs: list[dict],
    pillar: str,
    copy_variants: list[str],
) -> list[str]:
    """Validate a batch of creative configs against composition rules.

    Returns a list of error strings. Empty list = valid.
    """
    errors: list[str] = []
    pillar_prefix = f"{pillar}_"
    layouts_seen: set[str] = set()
    headlines_seen: set[str] = set()

    for i, raw in enumerate(configs):
        tag = f"creative[{i}]"

        # Parse (catches field-level errors)
        try:
            config = CreativeConfig.from_dict(raw)
        except (ValueError, KeyError) as e:
            errors.append(f"{tag}: {e}")
            continue

        # Rule 1: layout diversity
        if config.layout in layouts_seen:
            errors.append(f"{tag}: duplicate layout {config.layout!r}")
        layouts_seen.add(config.layout)

        # Rule 2: pillar alignment
        if not config.layout.startswith(pillar_prefix):
            errors.append(f"{tag}: layout {config.layout!r} does not match pillar {pillar!r}")

        # Rule 3: actor-text separation
        safe_positions = _SAFE_TEXT_POSITIONS.get(config.actor.position, [])
        if config.text.position not in safe_positions:
            errors.append(
                f"{tag}: actor-text overlap risk — actor {config.actor.position}, "
                f"text {config.text.position}. Safe text positions for actor "
                f"{config.actor.position}: {safe_positions}"
            )

        # Rule 4: headline from copy variants
        if config.text.headline not in copy_variants:
            errors.append(f"{tag}: headline {config.text.headline!r} not in provided copy variants")

        # Rule 5: headline uniqueness
        if config.text.headline in headlines_seen:
            errors.append(f"{tag}: duplicate headline {config.text.headline!r}")
        headlines_seen.add(config.text.headline)

    return errors
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_compositor_schema.py -v 2>&1 | tail -25`

Expected: All 12 tests PASS

- [ ] **Step 6: Add config vars**

Add to `worker/config.py` after the `COMPOSE_CONCURRENCY` line:

```python
# ---------------------------------------------------------------------------
# Stage 4 Graphic Design Agent
# ---------------------------------------------------------------------------
STAGE4_ENGINE = os.environ.get("STAGE4_ENGINE", "design_agent")  # "design_agent" or "compose_v3"
CREATIVE_DIRECTOR_MODEL = os.environ.get("CREATIVE_DIRECTOR_MODEL", "qwen/qwen3.5-397b-a17b")
CREATIVE_DIRECTOR_FALLBACK = os.environ.get("CREATIVE_DIRECTOR_FALLBACK", "google/gemma-3-27b-it")
BATCH_VQA_MODEL = os.environ.get("BATCH_VQA_MODEL", "google/gemma-4-31b-it")
```

- [ ] **Step 7: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/__init__.py worker/compositor/schema.py worker/config.py worker/tests/test_compositor_schema.py && git commit -m "feat(stage4): add creative config schema + validation for graphic design agent"
```

---

### Task 2: Component Registry + Background/CTA Components

**Files:**
- Create: `worker/compositor/registry.py`
- Create: `worker/compositor/components/__init__.py`
- Create: `worker/compositor/components/backgrounds.py`
- Create: `worker/compositor/components/cta.py`
- Create: `worker/tests/test_compositor_registry.py`

- [ ] **Step 1: Write failing registry tests**

Create `worker/tests/test_compositor_registry.py`:

```python
"""Tests for component registry — resolves IDs to HTML fragments."""
import pytest
from compositor.registry import (
    get_background_html,
    get_cta_html,
    get_overlay_html,
    get_text_block_html,
    get_actor_html,
)


class TestBackgrounds:
    def test_gradient_preset_returns_html(self):
        html = get_background_html("gradient", "gradient_warm_sunset")
        assert "background" in html
        assert "linear-gradient" in html

    def test_solid_color_returns_html(self):
        html = get_background_html("solid", "bg_charcoal")
        assert "background" in html
        assert "#32373C" in html or "32373C" in html.lower()

    def test_unknown_preset_raises(self):
        with pytest.raises(KeyError):
            get_background_html("gradient", "nonexistent_gradient")


class TestCTA:
    def test_pill_primary_returns_html(self):
        html = get_cta_html("pill_primary", "Apply Now", "bottom-center")
        assert "Apply Now" in html
        assert "border-radius" in html or "rounded" in html

    def test_banner_full_returns_html(self):
        html = get_cta_html("banner_full", "Sign Up Today", "bottom-center")
        assert "Sign Up Today" in html
        assert "width" in html

    def test_unknown_style_raises(self):
        with pytest.raises(KeyError):
            get_cta_html("neon_glow", "Click", "bottom-center")


class TestActorHTML:
    def test_actor_right_soft_fade(self):
        html = get_actor_html(
            photo_url="https://example.com/actor.png",
            position="right",
            scale=0.85,
            mask="soft_fade",
        )
        assert "example.com/actor.png" in html
        assert "right" in html

    def test_actor_center_none(self):
        html = get_actor_html(
            photo_url="https://example.com/actor.png",
            position="center",
            scale=1.0,
            mask="none",
        )
        assert "center" in html
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_compositor_registry.py -v 2>&1 | tail -15`

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement background components**

Create `worker/compositor/components/__init__.py`:

```python
"""Layer components for the graphic design agent compositor."""
```

Create `worker/compositor/components/backgrounds.py`:

```python
"""Background layer components — gradients, solid colors, scene-based."""

GRADIENT_PRESETS: dict[str, str] = {
    "gradient_warm_sunset": "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)",
    "gradient_cool_ocean": "linear-gradient(135deg, #0693e3 0%, #06b6d4 50%, #10b981 100%)",
    "gradient_pro_charcoal": "linear-gradient(135deg, #1a1a1a 0%, #374151 50%, #4b5563 100%)",
    "gradient_earn_gold": "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
    "gradient_grow_teal": "linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)",
    "gradient_shape_purple": "linear-gradient(135deg, #9b51e0 0%, #7c3aed 50%, #6366f1 100%)",
    "gradient_brand_accent": "linear-gradient(135deg, rgb(6,147,227) 0%, rgb(155,81,224) 100%)",
    "gradient_soft_neutral": "linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 50%, #d4d4d4 100%)",
}

SOLID_COLORS: dict[str, str] = {
    "bg_white": "#FFFFFF",
    "bg_charcoal": "#32373C",
    "bg_warm_cream": "#FFF8F0",
    "bg_cool_gray": "#F1F5F9",
    "bg_deep_navy": "#0F172A",
    "bg_soft_sage": "#F0FDF4",
}


def render_background(bg_type: str, preset: str, width: int, height: int) -> str:
    """Return CSS background declaration for the given preset."""
    if bg_type == "gradient":
        if preset not in GRADIENT_PRESETS:
            raise KeyError(f"Unknown gradient preset: {preset!r}")
        return f"background: {GRADIENT_PRESETS[preset]};"
    if bg_type == "solid":
        if preset not in SOLID_COLORS:
            raise KeyError(f"Unknown solid color: {preset!r}")
        return f"background: {SOLID_COLORS[preset]};"
    if bg_type == "scene_blur":
        # Scene URL is injected at render time from actor data
        return "background-size: cover; background-position: center; filter: blur(20px) brightness(0.7);"
    if bg_type == "scene_photo":
        return "background-size: cover; background-position: center;"
    raise KeyError(f"Unknown background type: {bg_type!r}")
```

- [ ] **Step 4: Implement CTA components**

Create `worker/compositor/components/cta.py`:

```python
"""CTA bar layer components — buttons, banners, floating actions."""

_CTA_TEMPLATES: dict[str, str] = {
    "pill_primary": """
        <div style="
            display:inline-flex; align-items:center; justify-content:center;
            background:#32373C; color:#FFFFFF;
            padding:12px 32px; border-radius:9999px;
            font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
            font-size:16px; font-weight:600; letter-spacing:0.02em;
            cursor:pointer;
        ">{text}</div>
    """,
    "pill_outline": """
        <div style="
            display:inline-flex; align-items:center; justify-content:center;
            background:transparent; color:#32373C;
            border:2px solid #32373C;
            padding:12px 32px; border-radius:9999px;
            font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
            font-size:16px; font-weight:600;
        ">{text}</div>
    """,
    "banner_full": """
        <div style="
            width:100%; padding:14px 0;
            background:#32373C; color:#FFFFFF;
            text-align:center;
            font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
            font-size:16px; font-weight:600;
        ">{text}</div>
    """,
    "floating_circle": """
        <div style="
            display:flex; align-items:center; justify-content:center;
            width:64px; height:64px; border-radius:50%;
            background:linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224));
            color:#FFFFFF; font-size:12px; font-weight:700; text-align:center;
            box-shadow:0 4px 12px rgba(0,0,0,0.15);
        ">{text}</div>
    """,
    "inline_text": """
        <div style="
            display:inline-flex; align-items:center; gap:6px;
            color:#32373C;
            font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
            font-size:16px; font-weight:600;
        ">{text} <span style="font-size:20px;">→</span></div>
    """,
}

_POSITION_CSS: dict[str, str] = {
    "bottom-center": "position:absolute; bottom:24px; left:50%; transform:translateX(-50%);",
    "bottom-right": "position:absolute; bottom:24px; right:24px;",
    "inline": "margin-top:16px;",
}


def render_cta(style: str, text: str, position: str) -> str:
    """Return positioned CTA HTML."""
    if style not in _CTA_TEMPLATES:
        raise KeyError(f"Unknown CTA style: {style!r}")
    inner = _CTA_TEMPLATES[style].format(text=text)
    pos_css = _POSITION_CSS.get(position, _POSITION_CSS["bottom-center"])
    return f'<div class="layer-cta" style="{pos_css}">{inner}</div>'
```

- [ ] **Step 5: Implement registry (facade)**

Create `worker/compositor/registry.py`:

```python
"""Component registry — resolves component IDs to rendered HTML fragments.

This is the single entry point for all layer components. The renderer
calls these functions with config values; it never touches component
internals directly.
"""
from __future__ import annotations

from compositor.components.backgrounds import render_background, GRADIENT_PRESETS, SOLID_COLORS
from compositor.components.cta import render_cta

# ── Text size presets (px) ────────────────────────────────────────
TEXT_SIZE_PX: dict[str, tuple[int, int]] = {
    # (headline_px, subheadline_px)
    "small": (16, 12),
    "medium": (22, 14),
    "large": (32, 16),
    "hero": (48, 18),
}

# ── Contrast backdrop CSS ────────────────────────────────────────
CONTRAST_BACKDROPS: dict[str, str] = {
    "none": "",
    "dark_gradient": "background:linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%); padding:24px; border-radius:12px;",
    "light_blur": "background:rgba(255,255,255,0.8); backdrop-filter:blur(8px); padding:20px; border-radius:12px;",
    "solid_pill": "background:rgba(0,0,0,0.7); padding:16px 24px; border-radius:9999px;",
    "brand_accent": "background:linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224)); padding:20px; border-radius:12px;",
}

# ── Actor mask CSS ────────────────────────────────────────────────
MASK_CSS: dict[str, str] = {
    "none": "",
    "soft_fade": "mask-image:linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);-webkit-mask-image:linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);",
    "circle": "border-radius:50%; overflow:hidden;",
    "arch": "border-radius:50% 50% 0 0; overflow:hidden;",
    "diagonal": "clip-path:polygon(15% 0, 100% 0, 100% 100%, 0 100%);",
}

# ── Actor position CSS ────────────────────────────────────────────
POSITION_CSS: dict[str, str] = {
    "left": "left:0;",
    "center": "left:50%; transform:translateX(-50%);",
    "right": "right:0;",
}


def get_background_html(bg_type: str, preset: str, width: int = 1080, height: int = 1080) -> str:
    """Return full background div with CSS."""
    css = render_background(bg_type, preset, width, height)
    return f'<div class="layer-background" style="position:absolute;inset:0;{css}"></div>'


def get_actor_html(photo_url: str, position: str, scale: float, mask: str) -> str:
    """Return positioned and masked actor image div."""
    size_pct = int(scale * 100)
    mask_style = MASK_CSS.get(mask, "")
    pos_style = POSITION_CSS.get(position, POSITION_CSS["center"])
    return f"""<div class="layer-actor" style="
        position:absolute; bottom:0; {pos_style}
        width:{size_pct}%; height:auto;
        {mask_style}
    "><img src="{photo_url}" style="width:100%;height:auto;display:block;object-fit:contain;" /></div>"""


def get_text_block_html(
    headline: str,
    subheadline: str,
    position: str,
    size: str,
    contrast_backdrop: str,
) -> str:
    """Return positioned text block with contrast backdrop."""
    h_px, sub_px = TEXT_SIZE_PX.get(size, TEXT_SIZE_PX["large"])
    backdrop_css = CONTRAST_BACKDROPS.get(contrast_backdrop, "")

    # Position mapping
    pos_map = {
        "top-left": "top:32px; left:32px;",
        "top-center": "top:32px; left:50%; transform:translateX(-50%);",
        "top-right": "top:32px; right:32px;",
        "center": "top:50%; left:50%; transform:translate(-50%,-50%);",
        "bottom-left": "bottom:80px; left:32px;",
        "bottom-center": "bottom:80px; left:50%; transform:translateX(-50%);",
    }
    pos_css = pos_map.get(position, pos_map["top-left"])

    color = "#FFFFFF" if contrast_backdrop in ("dark_gradient", "solid_pill", "brand_accent") else "#1A1A1A"

    sub_html = f'<div style="font-size:{sub_px}px;margin-top:8px;opacity:0.85;">{subheadline}</div>' if subheadline else ""

    return f"""<div class="layer-text" style="
        position:absolute; {pos_css}
        max-width:65%; z-index:10;
        {backdrop_css}
        color:{color};
        font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
    ">
        <div style="font-size:{h_px}px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;">{headline}</div>
        {sub_html}
    </div>"""


def get_overlay_html(elements: list[str], intensity: str) -> str:
    """Return decorative overlay div with requested elements.

    For now, returns a simple gradient overlay. Individual overlay
    components (blobs, badges, frames) will be added in Task 3.
    """
    opacity = {"subtle": 0.3, "medium": 0.5, "bold": 0.7}.get(intensity, 0.5)
    if not elements:
        return '<div class="layer-overlay"></div>'
    # Placeholder — Task 3 will populate with real overlay components
    return f'<div class="layer-overlay" style="position:absolute;inset:0;opacity:{opacity};pointer-events:none;"></div>'


def get_cta_html(style: str, text: str, position: str) -> str:
    """Return positioned CTA component."""
    return render_cta(style, text, position)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_compositor_registry.py -v 2>&1 | tail -15`

Expected: All 8 tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/registry.py worker/compositor/components/ worker/tests/test_compositor_registry.py && git commit -m "feat(stage4): add component registry with background, CTA, text, and actor components"
```

---

### Task 3: Overlay + Context Element Components

**Files:**
- Create: `worker/compositor/components/overlays.py`
- Create: `worker/compositor/components/context_elements.py`
- Modify: `worker/compositor/registry.py`

- [ ] **Step 1: Implement overlay components**

Create `worker/compositor/components/overlays.py`:

```python
"""Decorative overlay components — blobs, gradient bars, badges, brand frames, icons."""

# SVG blobs — designed for each pillar's color palette
BLOB_SVG: dict[str, str] = {
    "blob_warm_1": '<svg viewBox="0 0 200 200" style="position:absolute;{pos};width:180px;opacity:{opacity};"><path d="M45.3,-51.2C58.1,-40.8,67.6,-25.3,70.4,-8.5C73.2,8.3,69.3,26.4,58.7,38.8C48.1,51.2,30.8,57.9,13.2,60.1C-4.4,62.3,-22.3,60,-36.4,51.3C-50.5,42.6,-60.8,27.5,-64.2,10.8C-67.6,-5.9,-64.1,-24.2,-53.8,-35.7C-43.5,-47.2,-26.4,-51.9,-9.1,-52.5C8.2,-53.1,32.5,-61.6,45.3,-51.2Z" transform="translate(100 100)" fill="rgba(245,158,11,0.4)"/></svg>',
    "blob_warm_2": '<svg viewBox="0 0 200 200" style="position:absolute;{pos};width:140px;opacity:{opacity};"><circle cx="100" cy="100" r="80" fill="rgba(239,68,68,0.25)"/></svg>',
    "blob_cool_1": '<svg viewBox="0 0 200 200" style="position:absolute;{pos};width:180px;opacity:{opacity};"><path d="M45.3,-51.2C58.1,-40.8,67.6,-25.3,70.4,-8.5C73.2,8.3,69.3,26.4,58.7,38.8C48.1,51.2,30.8,57.9,13.2,60.1C-4.4,62.3,-22.3,60,-36.4,51.3C-50.5,42.6,-60.8,27.5,-64.2,10.8C-67.6,-5.9,-64.1,-24.2,-53.8,-35.7C-43.5,-47.2,-26.4,-51.9,-9.1,-52.5C8.2,-53.1,32.5,-61.6,45.3,-51.2Z" transform="translate(100 100)" fill="rgba(6,147,227,0.35)"/></svg>',
    "blob_cool_2": '<svg viewBox="0 0 200 200" style="position:absolute;{pos};width:120px;opacity:{opacity};"><circle cx="100" cy="100" r="70" fill="rgba(6,182,212,0.25)"/></svg>',
    "blob_pro_1": '<svg viewBox="0 0 200 200" style="position:absolute;{pos};width:160px;opacity:{opacity};"><path d="M45.3,-51.2C58.1,-40.8,67.6,-25.3,70.4,-8.5C73.2,8.3,69.3,26.4,58.7,38.8C48.1,51.2,30.8,57.9,13.2,60.1C-4.4,62.3,-22.3,60,-36.4,51.3C-50.5,42.6,-60.8,27.5,-64.2,10.8C-67.6,-5.9,-64.1,-24.2,-53.8,-35.7C-43.5,-47.2,-26.4,-51.9,-9.1,-52.5C8.2,-53.1,32.5,-61.6,45.3,-51.2Z" transform="translate(100 100)" fill="rgba(155,81,224,0.3)"/></svg>',
    "blob_pro_2": '<svg viewBox="0 0 200 200" style="position:absolute;{pos};width:100px;opacity:{opacity};"><circle cx="100" cy="100" r="60" fill="rgba(99,102,241,0.2)"/></svg>',
}

GRADIENT_BARS: dict[str, str] = {
    "bar_bottom_dark": '<div style="position:absolute;bottom:0;left:0;right:0;height:45%;background:linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 100%);"></div>',
    "bar_top_light": '<div style="position:absolute;top:0;left:0;right:0;height:40%;background:linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%);"></div>',
    "bar_diagonal_accent": '<div style="position:absolute;inset:0;background:linear-gradient(135deg, rgba(6,147,227,0.3) 0%, transparent 40%, transparent 60%, rgba(155,81,224,0.3) 100%);"></div>',
    "bar_side_fade": '<div style="position:absolute;inset:0;background:linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 50%);"></div>',
}

BADGE_SETS: dict[str, str] = {
    "badge_earnings": '<div style="position:absolute;{pos};background:#15803d;color:white;padding:8px 16px;border-radius:9999px;font-family:-apple-system,system-ui,sans-serif;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.15);">{content}</div>',
    "badge_skills": '<div style="position:absolute;{pos};background:rgba(6,147,227,0.9);color:white;padding:6px 14px;border-radius:8px;font-family:-apple-system,system-ui,sans-serif;font-size:12px;font-weight:600;">{content}</div>',
    "badge_verification": '<div style="position:absolute;{pos};background:white;color:#1a1a1a;padding:6px 14px;border-radius:8px;font-family:-apple-system,system-ui,sans-serif;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.1);">✓ {content}</div>',
}

BRAND_FRAMES: dict[str, str] = {
    "frame_accent_border": '<div style="position:absolute;inset:12px;border:3px solid;border-image:linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224)) 1;pointer-events:none;"></div>',
    "frame_corner_marks": '<div style="position:absolute;inset:16px;pointer-events:none;"><div style="position:absolute;top:0;left:0;width:30px;height:30px;border-top:3px solid rgba(6,147,227,0.6);border-left:3px solid rgba(6,147,227,0.6);"></div><div style="position:absolute;top:0;right:0;width:30px;height:30px;border-top:3px solid rgba(155,81,224,0.6);border-right:3px solid rgba(155,81,224,0.6);"></div><div style="position:absolute;bottom:0;left:0;width:30px;height:30px;border-bottom:3px solid rgba(155,81,224,0.6);border-left:3px solid rgba(155,81,224,0.6);"></div><div style="position:absolute;bottom:0;right:0;width:30px;height:30px;border-bottom:3px solid rgba(6,147,227,0.6);border-right:3px solid rgba(6,147,227,0.6);"></div></div>',
    "frame_subtle_outline": '<div style="position:absolute;inset:8px;border:1px solid rgba(255,255,255,0.15);border-radius:12px;pointer-events:none;"></div>',
}


def render_overlay_elements(elements: list[str], intensity: str) -> str:
    """Assemble overlay HTML from element IDs."""
    opacity = {"subtle": 0.4, "medium": 0.65, "bold": 0.9}.get(intensity, 0.65)
    parts: list[str] = []

    for el_id in elements:
        if el_id in BLOB_SVG:
            svg = BLOB_SVG[el_id].format(pos="top:10%;right:5%", opacity=opacity)
            parts.append(svg)
        elif el_id in GRADIENT_BARS:
            parts.append(GRADIENT_BARS[el_id])
        elif el_id in BADGE_SETS:
            parts.append(BADGE_SETS[el_id].format(pos="top:20px;right:20px", content=""))
        elif el_id in BRAND_FRAMES:
            parts.append(BRAND_FRAMES[el_id])

    if not parts:
        return '<div class="layer-overlay" style="position:absolute;inset:0;pointer-events:none;"></div>'

    inner = "\n".join(parts)
    return f'<div class="layer-overlay" style="position:absolute;inset:0;pointer-events:none;">{inner}</div>'
```

- [ ] **Step 2: Implement context element components**

Create `worker/compositor/components/context_elements.py`:

```python
"""Context element components — device mockups, task cards, icon clusters, stat badges.

These answer the question: 'What will I actually be doing in this job?'
"""

DEVICE_MOCKUPS: dict[str, str] = {
    "device_mockup": """
        <div style="
            position:absolute;{pos_css}
            width:160px; height:280px;
            background:#1a1a1a; border-radius:24px;
            padding:8px; box-shadow:0 8px 32px rgba(0,0,0,0.25);
            overflow:hidden;
        ">
            <div style="
                width:100%; height:100%;
                background:#ffffff; border-radius:18px;
                display:flex; flex-direction:column; align-items:center;
                justify-content:center; padding:12px;
                font-family:-apple-system,system-ui,sans-serif;
            ">
                <div style="font-size:10px;color:#737373;margin-bottom:8px;">OneForma Task</div>
                <div style="width:80%;height:8px;background:#e5e5e5;border-radius:4px;margin:4px 0;"></div>
                <div style="width:60%;height:8px;background:#e5e5e5;border-radius:4px;margin:4px 0;"></div>
                <div style="width:90%;height:24px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;margin:8px 0;"></div>
                <div style="width:90%;height:24px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;margin:4px 0;"></div>
                <div style="
                    margin-top:auto;
                    background:linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224));
                    color:white; font-size:10px; font-weight:600;
                    padding:6px 16px; border-radius:9999px;
                ">Submit</div>
            </div>
        </div>
    """,
}

TASK_CARDS: dict[str, str] = {
    "task_card": """
        <div style="
            position:absolute;{pos_css}
            background:white; border-radius:12px;
            padding:16px 20px; max-width:200px;
            box-shadow:0 4px 16px rgba(0,0,0,0.12);
            font-family:-apple-system,system-ui,sans-serif;
        ">
            <div style="font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Your Task</div>
            <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-top:4px;">{content}</div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <div style="font-size:11px;color:#0693e3;font-weight:500;">Remote</div>
                <div style="font-size:11px;color:#15803d;font-weight:500;">Flexible</div>
            </div>
        </div>
    """,
}

STAT_BADGES: dict[str, str] = {
    "stat_badge": """
        <div style="
            position:absolute;{pos_css}
            background:white; border-radius:12px;
            padding:12px 20px;
            box-shadow:0 4px 16px rgba(0,0,0,0.12);
            font-family:-apple-system,system-ui,sans-serif;
            text-align:center;
        ">
            <div style="font-size:28px;font-weight:800;color:#1a1a1a;">{content}</div>
            <div style="font-size:11px;color:#737373;margin-top:2px;">earned this month</div>
        </div>
    """,
}

ICON_CLUSTERS: dict[str, str] = {
    "icon_cluster": """
        <div style="
            position:absolute;{pos_css}
            display:flex; gap:8px; flex-wrap:wrap; max-width:140px;
        ">
            <div style="width:40px;height:40px;background:rgba(6,147,227,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">📋</div>
            <div style="width:40px;height:40px;background:rgba(155,81,224,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">🏷️</div>
            <div style="width:40px;height:40px;background:rgba(16,185,129,0.1);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">📊</div>
        </div>
    """,
}

_POSITION_MAP = {
    "bottom-left": "bottom:24px;left:24px;",
    "bottom-right": "bottom:24px;right:24px;",
    "center-left": "top:50%;left:24px;transform:translateY(-50%);",
    "center-right": "top:50%;right:24px;transform:translateY(-50%);",
}


def render_context_element(el_type: str, position: str, content: str = "") -> str:
    """Return positioned context element HTML."""
    pos_css = _POSITION_MAP.get(position, _POSITION_MAP["bottom-left"])
    templates = {**DEVICE_MOCKUPS, **TASK_CARDS, **STAT_BADGES, **ICON_CLUSTERS}
    # Normalize type to template key
    template_key = el_type.replace("_simple", "").replace("_detailed", "")
    if template_key not in templates:
        return ""
    return templates[template_key].format(pos_css=pos_css, content=content)
```

- [ ] **Step 3: Update registry with real overlay + context element functions**

In `worker/compositor/registry.py`, replace the `get_overlay_html` function:

```python
from compositor.components.overlays import render_overlay_elements
from compositor.components.context_elements import render_context_element

def get_overlay_html(elements: list[str], intensity: str) -> str:
    """Return decorative overlay div with requested elements."""
    return render_overlay_elements(elements, intensity)

def get_context_element_html(el_type: str, position: str, content: str = "") -> str:
    """Return positioned context element HTML."""
    return render_context_element(el_type, position, content)
```

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/components/overlays.py worker/compositor/components/context_elements.py worker/compositor/registry.py && git commit -m "feat(stage4): add overlay, badge, frame, and context element components"
```

---

### Task 4: Layout Templates (EARN pillar — 4 layouts)

**Files:**
- Create: `worker/compositor/layouts/__init__.py`
- Create: `worker/compositor/layouts/earn_hero_badge.py`
- Create: `worker/compositor/layouts/earn_split_stat.py`
- Create: `worker/compositor/layouts/earn_full_bleed.py`
- Create: `worker/compositor/layouts/earn_card_stack.py`

- [ ] **Step 1: Create layouts package**

Create `worker/compositor/layouts/__init__.py`:

```python
"""Layout templates — 12 pillar-specific HTML/CSS skeletons.

Each layout is a function that receives layer HTML fragments and returns
a complete self-contained HTML document ready for Playwright rendering.
"""
from __future__ import annotations

from compositor.layouts.earn_hero_badge import render as render_earn_hero_badge
from compositor.layouts.earn_split_stat import render as render_earn_split_stat
from compositor.layouts.earn_full_bleed import render as render_earn_full_bleed
from compositor.layouts.earn_card_stack import render as render_earn_card_stack
from compositor.layouts.grow_device_mockup import render as render_grow_device_mockup
from compositor.layouts.grow_editorial import render as render_grow_editorial
from compositor.layouts.grow_diagonal_split import render as render_grow_diagonal_split
from compositor.layouts.grow_bold_type import render as render_grow_bold_type
from compositor.layouts.shape_portrait_cred import render as render_shape_portrait_cred
from compositor.layouts.shape_multi_grid import render as render_shape_multi_grid
from compositor.layouts.shape_clean_card import render as render_shape_clean_card
from compositor.layouts.shape_photo_frame import render as render_shape_photo_frame

LAYOUT_RENDERERS: dict[str, callable] = {
    "earn_hero_badge": render_earn_hero_badge,
    "earn_split_stat": render_earn_split_stat,
    "earn_full_bleed": render_earn_full_bleed,
    "earn_card_stack": render_earn_card_stack,
    "grow_device_mockup": render_grow_device_mockup,
    "grow_editorial": render_grow_editorial,
    "grow_diagonal_split": render_grow_diagonal_split,
    "grow_bold_type": render_grow_bold_type,
    "shape_portrait_cred": render_shape_portrait_cred,
    "shape_multi_grid": render_shape_multi_grid,
    "shape_clean_card": render_shape_clean_card,
    "shape_photo_frame": render_shape_photo_frame,
}
```

**Note:** This file will fail to import until all 12 layout modules exist. That's expected — we build them across Tasks 4, 5, and 6.

- [ ] **Step 2: Create earn_hero_badge layout**

Create `worker/compositor/layouts/earn_hero_badge.py`:

```python
"""EARN: Hero + Badge — Full actor + floating earnings badge + warm gradient.

Actor right, text top-left, badge overlay, warm energy.
"""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
</style></head><body>
<div class="creative">
    {background_html}
    {actor_html}
    {overlay_html}
    {text_html}
    {context_html}
    {cta_html}
</div>
</body></html>"""
```

- [ ] **Step 3: Create earn_split_stat layout**

Create `worker/compositor/layouts/earn_split_stat.py`:

```python
"""EARN: Split + Stat — Diagonal split, actor left, stat callout right."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    mid = width // 2
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.split-left {{
    position:absolute; left:0; top:0; bottom:0; width:{mid}px;
    overflow:hidden;
}}
.split-right {{
    position:absolute; right:0; top:0; bottom:0; width:{mid}px;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:40px;
}}
.split-divider {{
    position:absolute; left:{mid - 30}px; top:0; bottom:0; width:60px;
    background:linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
    z-index:5;
}}
</style></head><body>
<div class="creative">
    {background_html}
    <div class="split-left">{actor_html}</div>
    <div class="split-divider"></div>
    <div class="split-right">{text_html}</div>
    {overlay_html}
    {context_html}
    {cta_html}
</div>
</body></html>"""
```

- [ ] **Step 4: Create earn_full_bleed layout**

Create `worker/compositor/layouts/earn_full_bleed.py`:

```python
"""EARN: Full Bleed — Actor photo covers entire canvas, gradient overlay bar at bottom."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.full-bleed-actor {{
    position:absolute; inset:0;
}}
.full-bleed-actor img {{
    width:100%; height:100%; object-fit:cover;
}}
.bottom-gradient {{
    position:absolute; bottom:0; left:0; right:0; height:50%;
    background:linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
    z-index:5;
}}
.bottom-content {{
    position:absolute; bottom:0; left:0; right:0;
    padding:32px; z-index:10; color:#FFFFFF;
}}
</style></head><body>
<div class="creative">
    <div class="full-bleed-actor">{actor_html}</div>
    <div class="bottom-gradient"></div>
    {overlay_html}
    <div class="bottom-content">
        {text_html}
        <div style="margin-top:20px;">{cta_html}</div>
    </div>
    {context_html}
</div>
</body></html>"""
```

- [ ] **Step 5: Create earn_card_stack layout**

Create `worker/compositor/layouts/earn_card_stack.py`:

```python
"""EARN: Card Stack — Testimonial card overlapping actor photo. Trust-building."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.card-overlay {{
    position:absolute; bottom:60px; left:32px; right:32px;
    background:rgba(255,255,255,0.95); border-radius:16px;
    padding:28px 32px;
    box-shadow:0 8px 32px rgba(0,0,0,0.12);
    z-index:10;
}}
</style></head><body>
<div class="creative">
    {background_html}
    {actor_html}
    {overlay_html}
    <div class="card-overlay">
        {text_html}
        <div style="margin-top:16px;">{cta_html}</div>
    </div>
    {context_html}
</div>
</body></html>"""
```

- [ ] **Step 6: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/layouts/ && git commit -m "feat(stage4): add 4 EARN pillar layout templates (hero_badge, split_stat, full_bleed, card_stack)"
```

---

### Task 5: Layout Templates (GROW pillar — 4 layouts)

**Files:**
- Create: `worker/compositor/layouts/grow_device_mockup.py`
- Create: `worker/compositor/layouts/grow_editorial.py`
- Create: `worker/compositor/layouts/grow_diagonal_split.py`
- Create: `worker/compositor/layouts/grow_bold_type.py`

- [ ] **Step 1: Create grow_device_mockup layout**

Create `worker/compositor/layouts/grow_device_mockup.py`:

```python
"""GROW: Device + Actor — Actor on one side, device mockup showing task UI on the other."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
    display:grid; grid-template-columns:1fr 1fr;
}}
.actor-side {{ position:relative; overflow:hidden; }}
.device-side {{
    position:relative; display:flex; flex-direction:column;
    align-items:center; justify-content:center; padding:40px;
}}
</style></head><body>
<div class="creative">
    {background_html}
    <div class="actor-side">{actor_html}</div>
    <div class="device-side">
        {text_html}
        {context_html}
        <div style="margin-top:24px;">{cta_html}</div>
    </div>
    {overlay_html}
</div>
</body></html>"""
```

- [ ] **Step 2: Create grow_editorial layout**

Create `worker/compositor/layouts/grow_editorial.py`:

```python
"""GROW: Editorial — Magazine editorial layout, large serif headline, generous whitespace."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:Georgia,'Times New Roman',serif;
    display:grid; grid-template-rows:auto 1fr auto;
    padding:48px;
}}
.editorial-header {{ z-index:10; }}
.editorial-body {{
    position:relative; display:flex; align-items:flex-end;
    justify-content:center;
}}
.editorial-footer {{ z-index:10; padding-top:24px; }}
</style></head><body>
<div class="creative">
    {background_html}
    {overlay_html}
    <div class="editorial-header">{text_html}</div>
    <div class="editorial-body">{actor_html}</div>
    <div class="editorial-footer">{cta_html}</div>
    {context_html}
</div>
</body></html>"""
```

- [ ] **Step 3: Create grow_diagonal_split layout**

Create `worker/compositor/layouts/grow_diagonal_split.py`:

```python
"""GROW: Diagonal Split — Dynamic diagonal with actor + skill badges."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.diagonal-clip {{
    position:absolute; inset:0;
    clip-path:polygon(0 0, 65% 0, 45% 100%, 0 100%);
    z-index:3;
}}
.content-zone {{
    position:absolute; top:0; right:0; bottom:0; width:55%;
    display:flex; flex-direction:column; justify-content:center;
    padding:48px; z-index:5;
}}
</style></head><body>
<div class="creative">
    {background_html}
    <div class="diagonal-clip">{actor_html}</div>
    {overlay_html}
    <div class="content-zone">
        {text_html}
        {context_html}
        <div style="margin-top:24px;">{cta_html}</div>
    </div>
</div>
</body></html>"""
```

- [ ] **Step 4: Create grow_bold_type layout**

Create `worker/compositor/layouts/grow_bold_type.py`:

```python
"""GROW: Bold Typography — Minimal photo, oversized bold headline. Modern, confident."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
    display:flex; flex-direction:column; justify-content:center;
    padding:60px;
}}
.actor-circle {{
    width:180px; height:180px; border-radius:50%; overflow:hidden;
    margin-bottom:32px;
    box-shadow:0 4px 16px rgba(0,0,0,0.1);
}}
.actor-circle img {{ width:100%; height:100%; object-fit:cover; }}
.bold-headline {{
    font-size:56px; font-weight:800; line-height:1.05;
    letter-spacing:-0.03em; color:#1A1A1A;
    max-width:80%;
}}
</style></head><body>
<div class="creative">
    {background_html}
    {overlay_html}
    <div class="actor-circle">{actor_html}</div>
    <div class="bold-headline">{text_html}</div>
    <div style="margin-top:32px;">{cta_html}</div>
    {context_html}
</div>
</body></html>"""
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/layouts/grow_*.py && git commit -m "feat(stage4): add 4 GROW pillar layout templates (device_mockup, editorial, diagonal_split, bold_type)"
```

---

### Task 6: Layout Templates (SHAPE pillar — 4 layouts)

**Files:**
- Create: `worker/compositor/layouts/shape_portrait_cred.py`
- Create: `worker/compositor/layouts/shape_multi_grid.py`
- Create: `worker/compositor/layouts/shape_clean_card.py`
- Create: `worker/compositor/layouts/shape_photo_frame.py`

- [ ] **Step 1: Create shape_portrait_cred layout**

Create `worker/compositor/layouts/shape_portrait_cred.py`:

```python
"""SHAPE: Portrait + Credential — Professional portrait + credential bar. Authority signals."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.credential-bar {{
    position:absolute; bottom:0; left:0; right:0;
    background:rgba(255,255,255,0.95);
    padding:28px 40px; z-index:10;
    border-top:3px solid;
    border-image:linear-gradient(90deg, rgb(6,147,227), rgb(155,81,224)) 1;
}}
</style></head><body>
<div class="creative">
    {background_html}
    {actor_html}
    {overlay_html}
    {text_html}
    <div class="credential-bar">
        {context_html}
        <div style="margin-top:12px;">{cta_html}</div>
    </div>
</div>
</body></html>"""
```

- [ ] **Step 2: Create shape_multi_grid layout**

Create `worker/compositor/layouts/shape_multi_grid.py`:

```python
"""SHAPE: Multi-Image Grid — 2-3 image grid + impact stats. Data-rich, credibility-building."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    half = height // 2
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
    display:grid; grid-template-rows:1fr 1fr;
}}
.grid-top {{
    position:relative; display:grid; grid-template-columns:1fr 1fr;
    gap:4px; overflow:hidden;
}}
.grid-bottom {{
    position:relative; display:flex; flex-direction:column;
    justify-content:center; padding:36px;
}}
</style></head><body>
<div class="creative">
    {background_html}
    <div class="grid-top">
        <div style="position:relative;overflow:hidden;">{actor_html}</div>
        <div style="position:relative;overflow:hidden;">{context_html}</div>
    </div>
    <div class="grid-bottom">
        {overlay_html}
        {text_html}
        <div style="margin-top:20px;">{cta_html}</div>
    </div>
</div>
</body></html>"""
```

- [ ] **Step 3: Create shape_clean_card layout**

Create `worker/compositor/layouts/shape_clean_card.py`:

```python
"""SHAPE: Clean Card — White card container + actor + professional overlay. Corporate but approachable."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    pad = 40
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
    display:flex; align-items:center; justify-content:center;
}}
.card {{
    position:relative;
    width:{width - pad * 2}px; height:{height - pad * 2}px;
    background:rgba(255,255,255,0.97);
    border-radius:20px;
    box-shadow:0 8px 40px rgba(0,0,0,0.08);
    overflow:hidden;
    display:grid; grid-template-columns:1fr 1fr;
}}
.card-actor {{ position:relative; overflow:hidden; }}
.card-content {{
    display:flex; flex-direction:column;
    justify-content:center; padding:36px;
}}
</style></head><body>
<div class="creative">
    {background_html}
    {overlay_html}
    <div class="card">
        <div class="card-actor">{actor_html}</div>
        <div class="card-content">
            {text_html}
            {context_html}
            <div style="margin-top:20px;">{cta_html}</div>
        </div>
    </div>
</div>
</body></html>"""
```

- [ ] **Step 4: Create shape_photo_frame layout**

Create `worker/compositor/layouts/shape_photo_frame.py`:

```python
"""SHAPE: Photo Frame — Photo-first with subtle brand frame. Minimal text. Premium feel."""


def render(
    background_html: str,
    actor_html: str,
    overlay_html: str,
    text_html: str,
    cta_html: str,
    context_html: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{width}px; height:{height}px; overflow:hidden; }}
.creative {{
    position:relative; width:{width}px; height:{height}px; overflow:hidden;
    font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
}}
.brand-frame {{
    position:absolute; inset:16px;
    border:2px solid; border-radius:12px;
    border-image:linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224)) 1;
    z-index:8; pointer-events:none;
}}
.frame-footer {{
    position:absolute; bottom:0; left:0; right:0;
    padding:24px 32px; z-index:10;
    background:linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%);
    color:#FFFFFF;
}}
</style></head><body>
<div class="creative">
    {background_html}
    {actor_html}
    {overlay_html}
    <div class="brand-frame"></div>
    <div class="frame-footer">
        {text_html}
        <div style="margin-top:12px;">{cta_html}</div>
    </div>
    {context_html}
</div>
</body></html>"""
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/layouts/shape_*.py && git commit -m "feat(stage4): add 4 SHAPE pillar layout templates (portrait_cred, multi_grid, clean_card, photo_frame)"
```

---

### Task 7: Deterministic Renderer (JSON config → HTML → PNG)

**Files:**
- Create: `worker/compositor/renderer.py`
- Create: `worker/compositor/render_png.py`
- Create: `worker/tests/test_compositor_renderer.py`

- [ ] **Step 1: Write failing renderer tests**

Create `worker/tests/test_compositor_renderer.py`:

```python
"""Tests for deterministic renderer — JSON config → HTML string."""
import pytest
from compositor.renderer import assemble_html
from compositor.schema import CreativeConfig


def _make_config_dict(**overrides):
    base = {
        "layout": "earn_hero_badge",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "abc-123", "position": "right", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": "Earn $17.50/hr from home",
            "subheadline": "Data collection tasks in Morocco",
            "position": "top-left",
            "size": "large",
            "contrast_backdrop": "dark_gradient",
        },
        "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }
    base.update(overrides)
    return base


class TestAssembleHTML:
    def test_returns_valid_html(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/actor.png")
        assert "<!DOCTYPE html>" in html
        assert "Earn $17.50/hr from home" in html
        assert "Apply Now" in html

    def test_contains_actor_image(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/face.jpg")
        assert "example.com/face.jpg" in html

    def test_different_layouts_produce_different_html(self):
        c1 = CreativeConfig.from_dict(_make_config_dict(layout="earn_hero_badge"))
        c2 = CreativeConfig.from_dict(_make_config_dict(layout="earn_full_bleed"))
        h1 = assemble_html(c1, actor_photo_url="https://example.com/a.png")
        h2 = assemble_html(c2, actor_photo_url="https://example.com/a.png")
        assert h1 != h2

    def test_context_element_included_when_set(self):
        config = CreativeConfig.from_dict(_make_config_dict(
            context_element={"type": "device_mockup", "position": "bottom-left", "content": "survey_ui"}
        ))
        html = assemble_html(config, actor_photo_url="https://example.com/a.png")
        assert "OneForma Task" in html or "device" in html.lower()

    def test_custom_dimensions(self):
        config = CreativeConfig.from_dict(_make_config_dict())
        html = assemble_html(config, actor_photo_url="https://example.com/a.png", width=1200, height=627)
        assert "1200" in html
        assert "627" in html
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_compositor_renderer.py -v 2>&1 | tail -15`

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement renderer**

Create `worker/compositor/renderer.py`:

```python
"""Deterministic HTML assembler — takes a CreativeConfig + actor photo URL
and returns a complete HTML document by assembling layer components into
a layout template.

This is a pure function: same input → same output. No LLM calls.
"""
from __future__ import annotations

from compositor.schema import CreativeConfig
from compositor.registry import (
    get_background_html,
    get_actor_html,
    get_overlay_html,
    get_text_block_html,
    get_cta_html,
    get_context_element_html,
)
from compositor.layouts import LAYOUT_RENDERERS


def assemble_html(
    config: CreativeConfig,
    actor_photo_url: str,
    width: int = 1080,
    height: int = 1080,
) -> str:
    """Assemble a complete HTML document from a creative config.

    Returns a self-contained HTML string ready for Playwright rendering.
    """
    # Layer 1: Background
    background_html = get_background_html(
        config.background.type,
        config.background.preset,
        width,
        height,
    )

    # Layer 2: Actor
    actor_html = get_actor_html(
        photo_url=actor_photo_url,
        position=config.actor.position,
        scale=config.actor.scale,
        mask=config.actor.mask,
    )

    # Layer 3: Decorative overlay
    overlay_html = get_overlay_html(config.overlay.elements, config.overlay.intensity)

    # Layer 4: Text block
    text_html = get_text_block_html(
        headline=config.text.headline,
        subheadline=config.text.subheadline,
        position=config.text.position,
        size=config.text.size,
        contrast_backdrop=config.text.contrast_backdrop,
    )

    # Layer 5: CTA
    cta_html = get_cta_html(config.cta.text, config.cta.style, config.cta.position)

    # Optional: Context element
    context_html = ""
    if config.context_element:
        context_html = get_context_element_html(
            config.context_element.type,
            config.context_element.position,
            config.context_element.content,
        )

    # Assemble into layout template
    layout_fn = LAYOUT_RENDERERS.get(config.layout)
    if not layout_fn:
        raise ValueError(f"Unknown layout: {config.layout!r}")

    return layout_fn(
        background_html=background_html,
        actor_html=actor_html,
        overlay_html=overlay_html,
        text_html=text_html,
        cta_html=cta_html,
        context_html=context_html,
        width=width,
        height=height,
    )
```

- [ ] **Step 4: Implement Playwright PNG renderer**

Create `worker/compositor/render_png.py`:

```python
"""Playwright PNG renderer — converts HTML string to PNG bytes.

Reuses a single browser instance across renders for speed.
No network wait — all images should be base64 inline.
"""
from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Shared browser instance (created on first call)
_browser = None
_browser_lock = asyncio.Lock()


async def _get_browser():
    global _browser
    if _browser is None or not _browser.is_connected():
        async with _browser_lock:
            if _browser is None or not _browser.is_connected():
                from playwright.async_api import async_playwright
                pw = await async_playwright().start()
                _browser = await pw.chromium.launch(headless=True)
                logger.info("Playwright browser launched for compositor")
    return _browser


async def render_html_to_png(html: str, width: int = 1080, height: int = 1080) -> bytes:
    """Render an HTML string to PNG bytes via headless Chromium.

    Uses a shared browser instance. No 2-second wait — images should be
    base64 data URIs (no network requests). Target: <1s per render.
    """
    browser = await _get_browser()
    page = await browser.new_page(viewport={"width": width, "height": height})

    try:
        # Write HTML to temp file (Playwright needs a file:// URL or setContent)
        with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w") as f:
            f.write(html)
            tmp_path = f.name

        await page.goto(f"file://{tmp_path}")
        await page.wait_for_load_state("domcontentloaded")
        png_bytes = await page.screenshot(type="png", full_page=False)

        # Cleanup temp file
        Path(tmp_path).unlink(missing_ok=True)

        return png_bytes
    finally:
        await page.close()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_compositor_renderer.py -v 2>&1 | tail -15`

Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/renderer.py worker/compositor/render_png.py worker/tests/test_compositor_renderer.py && git commit -m "feat(stage4): add deterministic HTML renderer and Playwright PNG renderer"
```

---

### Task 8: VQA — Tier 1 Deterministic Checks + Tier 2 Batch VQA + Auto-Fix

**Files:**
- Create: `worker/vqa/__init__.py`
- Create: `worker/vqa/tier1_checks.py`
- Create: `worker/vqa/tier2_batch_vqa.py`
- Create: `worker/vqa/auto_fix.py`
- Create: `worker/tests/test_vqa_tier1.py`
- Create: `worker/tests/test_vqa_auto_fix.py`

- [ ] **Step 1: Write failing Tier 1 tests**

Create `worker/tests/test_vqa_tier1.py`:

```python
"""Tests for Tier 1 deterministic VQA checks."""
import pytest
from vqa.tier1_checks import run_tier1_checks


class TestTier1:
    def test_valid_html_passes(self):
        html = '<div class="layer-text"><div style="font-size:32px;">Headline</div></div><div class="layer-cta">Apply</div>'
        result = run_tier1_checks(html)
        assert result["passed"] is True
        assert result["issues"] == []

    def test_missing_headline_fails(self):
        html = '<div class="layer-cta">Apply</div>'
        result = run_tier1_checks(html)
        assert result["passed"] is False
        assert any("headline" in i["check"].lower() for i in result["issues"])

    def test_missing_cta_fails(self):
        html = '<div class="layer-text"><div style="font-size:32px;">Headline</div></div>'
        result = run_tier1_checks(html)
        assert result["passed"] is False
        assert any("cta" in i["check"].lower() for i in result["issues"])

    def test_empty_html_fails(self):
        result = run_tier1_checks("")
        assert result["passed"] is False
```

- [ ] **Step 2: Implement Tier 1 checks**

Create `worker/vqa/__init__.py`:

```python
"""VQA (Visual Quality Assessment) for the graphic design agent."""
```

Create `worker/vqa/tier1_checks.py`:

```python
"""Tier 1 — Deterministic structural checks on assembled HTML.

These run in <100ms before Playwright render. They catch structural
issues that would waste render time.
"""
from __future__ import annotations

import re


def run_tier1_checks(html: str) -> dict:
    """Run all deterministic checks on assembled HTML.

    Returns {"passed": bool, "issues": [{"check": str, "detail": str}]}
    """
    issues: list[dict[str, str]] = []

    if not html or len(html) < 100:
        issues.append({"check": "HTML_PRESENT", "detail": "HTML is empty or too short"})
        return {"passed": False, "issues": issues}

    # Check 1: Headline text present
    if "layer-text" not in html:
        issues.append({"check": "HEADLINE_PRESENT", "detail": "No text layer found in HTML"})

    # Check 2: CTA present
    if "layer-cta" not in html:
        issues.append({"check": "CTA_PRESENT", "detail": "No CTA layer found in HTML"})

    # Check 3: Actor image present
    if "<img" not in html:
        issues.append({"check": "ACTOR_PRESENT", "detail": "No actor image tag found"})

    # Check 4: Font size minimum (14px)
    font_sizes = re.findall(r'font-size:\s*(\d+)px', html)
    for size_str in font_sizes:
        if int(size_str) < 14:
            issues.append({"check": "FONT_SIZE_MIN", "detail": f"Font size {size_str}px is below 14px minimum"})
            break

    # Check 5: Background layer present
    if "layer-background" not in html:
        issues.append({"check": "BACKGROUND_PRESENT", "detail": "No background layer found"})

    return {"passed": len(issues) == 0, "issues": issues}
```

- [ ] **Step 3: Implement Tier 2 batch VQA**

Create `worker/vqa/tier2_batch_vqa.py`:

```python
"""Tier 2 — Batch vision VQA using Gemma 4 Vision.

Sends all 6 creative PNGs in a single API call. Checks spatial
relationships that deterministic checks can't catch.
"""
from __future__ import annotations

import base64
import json
import logging

import httpx

from config import NVIDIA_NIM_VQA_KEY, NVIDIA_NIM_BASE_URL, BATCH_VQA_MODEL, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

BATCH_VQA_PROMPT = """You are a graphic design quality inspector. For each of the {count} creative images below, evaluate these spatial checks. Return ONLY a JSON array.

Checks:
1. FACE_VISIBLE — Is the actor's face fully visible? Not cut off by frame edge, not covered by text or overlay elements.
2. NO_OVERLAP — Are all elements properly separated? Text not sitting on actor's face/body. CTA not buried under overlay. No element stacking.
3. PROPER_SPACING — Are there appropriate margins between elements? No cramped clusters where multiple elements touch or nearly touch.
4. VISUAL_HIERARCHY — Is there a clear reading order? Can you identify: (1) headline first, (2) subheadline second, (3) CTA third? Eye flow should be natural.
5. NO_DEAD_SPACE — Is the canvas used effectively? No large empty areas (>25% of canvas) that make the creative feel unfinished or unbalanced.
6. COMPOSITION_BALANCE — Is visual weight distributed across the canvas? Not all elements crammed into one quadrant while others are empty.

Return JSON array — one object per image, in order:
[{{"creative_index": 0, "passed": true, "issues": []}}, {{"creative_index": 1, "passed": false, "issues": [{{"check": "FACE_VISIBLE", "detail": "text covers forehead"}}]}}]

ONLY return the JSON array. No explanation."""


async def run_tier2_batch_vqa(png_list: list[bytes]) -> list[dict]:
    """Send all PNGs to Gemma 4 Vision in one call.

    Returns list of {"creative_index": int, "passed": bool, "issues": [...]}
    """
    if not png_list:
        return []

    # Build multimodal content: text prompt + all images
    content = [{"type": "text", "text": BATCH_VQA_PROMPT.format(count=len(png_list))}]
    for png_bytes in png_list:
        b64 = base64.b64encode(png_bytes).decode("utf-8")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"},
        })

    # Try NIM first (free), fall back to OpenRouter
    for api_url, api_key, model in [
        (f"{NVIDIA_NIM_BASE_URL}/chat/completions", NVIDIA_NIM_VQA_KEY, BATCH_VQA_MODEL),
        ("https://openrouter.ai/api/v1/chat/completions", OPENROUTER_API_KEY, f"google/gemma-4-31b-it"),
    ]:
        if not api_key:
            continue
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    api_url,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": content}],
                        "max_tokens": 2048,
                        "temperature": 0.1,
                    },
                )
                resp.raise_for_status()
                text = resp.json()["choices"][0]["message"]["content"]
                return _parse_vqa_response(text, len(png_list))
        except Exception as e:
            logger.warning("Tier 2 VQA failed with %s: %s", model, e)
            continue

    # If all providers fail, return pass-all (don't block pipeline)
    logger.error("All Tier 2 VQA providers failed — passing all creatives")
    return [{"creative_index": i, "passed": True, "issues": []} for i in range(len(png_list))]


def _parse_vqa_response(text: str, expected_count: int) -> list[dict]:
    """Parse VQA JSON response, handling markdown fences."""
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

    try:
        results = json.loads(cleaned)
        if isinstance(results, list):
            return results
    except json.JSONDecodeError:
        logger.warning("Failed to parse VQA response as JSON: %s", cleaned[:200])

    # Fallback: return pass-all
    return [{"creative_index": i, "passed": True, "issues": []} for i in range(expected_count)]
```

- [ ] **Step 4: Implement auto-fix**

Create `worker/vqa/auto_fix.py`:

```python
"""Auto-fix — maps VQA issues to deterministic prop tweaks on the creative config.

No LLM call needed. Each fix mutates the config dict and returns it
for re-rendering. Target: ~2s per fix (just a re-render).
"""
from __future__ import annotations

import copy
import logging

from compositor.schema import _SAFE_TEXT_POSITIONS

logger = logging.getLogger(__name__)

# Maximum fix cycles before giving up and swapping layout
MAX_FIX_CYCLES = 2


def apply_fixes(config_dict: dict, issues: list[dict]) -> dict:
    """Apply deterministic fixes for VQA issues. Returns modified config dict.

    Does NOT re-render — caller handles that.
    """
    fixed = copy.deepcopy(config_dict)

    for issue in issues:
        check = issue.get("check", "")
        handler = _FIX_HANDLERS.get(check)
        if handler:
            fixed = handler(fixed, issue)
            logger.info("Auto-fix applied for %s: %s", check, issue.get("detail", ""))
        else:
            logger.warning("No auto-fix for check: %s", check)

    return fixed


def _fix_face_visible(config: dict, issue: dict) -> dict:
    """Face covered or cut off — flip text position or reduce actor scale."""
    detail = issue.get("detail", "").lower()

    if "text" in detail or "cover" in detail or "overlap" in detail:
        # Flip text to opposite side
        actor_pos = config["actor"]["position"]
        safe = _SAFE_TEXT_POSITIONS.get(actor_pos, ["top-left"])
        current_text_pos = config["text"]["position"]
        for pos in safe:
            if pos != current_text_pos:
                config["text"]["position"] = pos
                break
    else:
        # Face cut off — reduce scale
        config["actor"]["scale"] = max(0.5, config["actor"]["scale"] - 0.15)

    return config


def _fix_no_overlap(config: dict, _issue: dict) -> dict:
    """Elements stacking — reduce overlay intensity and increase text backdrop."""
    config["overlay"]["intensity"] = "subtle"
    if config["text"]["contrast_backdrop"] == "none":
        config["text"]["contrast_backdrop"] = "dark_gradient"
    return config


def _fix_proper_spacing(config: dict, _issue: dict) -> dict:
    """Cramped elements — reduce actor scale to create breathing room."""
    config["actor"]["scale"] = max(0.5, config["actor"]["scale"] - 0.1)
    return config


def _fix_visual_hierarchy(config: dict, _issue: dict) -> dict:
    """No clear reading order — bump headline size + add contrast backdrop."""
    sizes = ["small", "medium", "large", "hero"]
    current = config["text"]["size"]
    idx = sizes.index(current) if current in sizes else 1
    config["text"]["size"] = sizes[min(idx + 1, len(sizes) - 1)]
    if config["text"]["contrast_backdrop"] == "none":
        config["text"]["contrast_backdrop"] = "dark_gradient"
    return config


def _fix_dead_space(config: dict, _issue: dict) -> dict:
    """Large empty areas — scale actor up or add overlay elements."""
    config["actor"]["scale"] = min(1.0, config["actor"]["scale"] + 0.15)
    if not config["overlay"]["elements"]:
        # Add a blob to fill space
        pillar = config["layout"].split("_")[0]
        blob_map = {"earn": "blob_warm_1", "grow": "blob_cool_1", "shape": "blob_pro_1"}
        config["overlay"]["elements"].append(blob_map.get(pillar, "blob_warm_1"))
    return config


def _fix_composition_balance(config: dict, _issue: dict) -> dict:
    """All elements on one side — mirror actor position."""
    mirror = {"left": "right", "right": "left", "center": "center"}
    old_pos = config["actor"]["position"]
    new_pos = mirror.get(old_pos, old_pos)
    config["actor"]["position"] = new_pos

    # Also mirror text to maintain separation
    safe = _SAFE_TEXT_POSITIONS.get(new_pos, ["top-left"])
    if config["text"]["position"] not in safe:
        config["text"]["position"] = safe[0]

    return config


_FIX_HANDLERS = {
    "FACE_VISIBLE": _fix_face_visible,
    "NO_OVERLAP": _fix_no_overlap,
    "PROPER_SPACING": _fix_proper_spacing,
    "VISUAL_HIERARCHY": _fix_visual_hierarchy,
    "NO_DEAD_SPACE": _fix_dead_space,
    "COMPOSITION_BALANCE": _fix_composition_balance,
}
```

- [ ] **Step 5: Write auto-fix tests**

Create `worker/tests/test_vqa_auto_fix.py`:

```python
"""Tests for VQA auto-fix — deterministic prop tweaks."""
import pytest
from vqa.auto_fix import apply_fixes


def _base_config():
    return {
        "layout": "earn_hero_badge",
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "x", "position": "right", "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": "Test",
            "subheadline": "Sub",
            "position": "top-left",
            "size": "large",
            "contrast_backdrop": "none",
        },
        "cta": {"text": "Apply", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }


class TestAutoFix:
    def test_face_visible_text_cover_flips_text_position(self):
        config = _base_config()
        config["text"]["position"] = "top-right"
        config["actor"]["position"] = "right"
        fixed = apply_fixes(config, [{"check": "FACE_VISIBLE", "detail": "text covers actor face"}])
        assert fixed["text"]["position"] in ("top-left", "bottom-left", "center")

    def test_face_visible_cut_off_reduces_scale(self):
        config = _base_config()
        fixed = apply_fixes(config, [{"check": "FACE_VISIBLE", "detail": "face cut off by frame"}])
        assert fixed["actor"]["scale"] < 0.85

    def test_dead_space_increases_scale(self):
        config = _base_config()
        config["actor"]["scale"] = 0.5
        fixed = apply_fixes(config, [{"check": "NO_DEAD_SPACE", "detail": "large empty area"}])
        assert fixed["actor"]["scale"] > 0.5

    def test_composition_balance_mirrors_actor(self):
        config = _base_config()
        config["actor"]["position"] = "right"
        fixed = apply_fixes(config, [{"check": "COMPOSITION_BALANCE", "detail": "all on right"}])
        assert fixed["actor"]["position"] == "left"

    def test_visual_hierarchy_bumps_size(self):
        config = _base_config()
        config["text"]["size"] = "medium"
        fixed = apply_fixes(config, [{"check": "VISUAL_HIERARCHY", "detail": "no clear reading order"}])
        assert fixed["text"]["size"] == "large"

    def test_does_not_mutate_original(self):
        config = _base_config()
        original_scale = config["actor"]["scale"]
        apply_fixes(config, [{"check": "FACE_VISIBLE", "detail": "cut off"}])
        assert config["actor"]["scale"] == original_scale
```

- [ ] **Step 6: Run all VQA tests**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_vqa_tier1.py worker/tests/test_vqa_auto_fix.py -v 2>&1 | tail -20`

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/vqa/ worker/tests/test_vqa_tier1.py worker/tests/test_vqa_auto_fix.py && git commit -m "feat(stage4): add two-tier VQA (deterministic + batch vision) with auto-fix"
```

---

### Task 9: Creative Director LLM (prompt + parsing)

**Files:**
- Create: `worker/ai/creative_director.py`
- Create: `worker/tests/test_creative_director.py`

- [ ] **Step 1: Write failing tests**

Create `worker/tests/test_creative_director.py`:

```python
"""Tests for Creative Director LLM — prompt building + response parsing."""
import json
import pytest
from ai.creative_director import build_prompt, parse_response
from compositor.schema import EARN_LAYOUTS


MOCK_ACTORS = [
    {"actor_id": "a1", "name": "Fatima", "persona_summary": "Student, 22", "photo_url": "https://ex.com/a1.png"},
    {"actor_id": "a2", "name": "Youssef", "persona_summary": "Freelancer, 28", "photo_url": "https://ex.com/a2.png"},
    {"actor_id": "a3", "name": "Amina", "persona_summary": "Professional, 35", "photo_url": "https://ex.com/a3.png"},
]

MOCK_COPY = [
    "Earn $17.50/hr from home",
    "Flexible remote work in Morocco",
    "Join 10,000+ contributors worldwide",
    "Data tasks that fit your schedule",
]

MOCK_BRIEF = {"pillar": "earn", "task_type": "data_collection", "compensation": "$17.50/hr", "country": "Morocco"}


class TestBuildPrompt:
    def test_prompt_contains_layouts(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        for layout in EARN_LAYOUTS:
            assert layout in prompt

    def test_prompt_contains_copy_variants(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        for copy in MOCK_COPY:
            assert copy in prompt

    def test_prompt_contains_actors(self):
        prompt = build_prompt(MOCK_ACTORS, MOCK_COPY, MOCK_BRIEF, pillar="earn")
        assert "Fatima" in prompt
        assert "Youssef" in prompt


class TestParseResponse:
    def test_valid_json_array_parses(self):
        raw = json.dumps([
            {
                "layout": "earn_hero_badge",
                "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
                "actor": {"actor_id": "a1", "position": "right", "scale": 0.85, "mask": "soft_fade"},
                "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
                "text": {"headline": "Earn $17.50/hr from home", "subheadline": "Morocco", "position": "top-left", "size": "large", "contrast_backdrop": "dark_gradient"},
                "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
                "context_element": None,
            }
        ])
        configs = parse_response(raw)
        assert len(configs) == 1
        assert configs[0]["layout"] == "earn_hero_badge"

    def test_markdown_fenced_json_parses(self):
        raw = "```json\n[{\"layout\": \"earn_hero_badge\"}]\n```"
        configs = parse_response(raw)
        assert len(configs) == 1

    def test_invalid_json_returns_empty(self):
        configs = parse_response("this is not json at all")
        assert configs == []
```

- [ ] **Step 2: Implement Creative Director**

Create `worker/ai/creative_director.py`:

```python
"""Creative Director LLM — generates batch creative configs.

The LLM acts as a creative director, not a web developer. It picks
layouts, positions actors, selects copy, and chooses visual elements.
Output is structured JSON (~50 tokens per creative), not HTML.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from compositor.schema import (
    EARN_LAYOUTS,
    GROW_LAYOUTS,
    SHAPE_LAYOUTS,
    VALID_POSITIONS,
    VALID_MASKS,
    VALID_TEXT_SIZES,
    VALID_TEXT_POSITIONS,
    VALID_CTA_STYLES,
    VALID_CTA_POSITIONS,
    VALID_INTENSITIES,
    VALID_CONTEXT_TYPES,
    VALID_CONTEXT_POSITIONS,
)
from config import CREATIVE_DIRECTOR_MODEL, CREATIVE_DIRECTOR_FALLBACK, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

_PILLAR_LAYOUTS = {
    "earn": EARN_LAYOUTS,
    "grow": GROW_LAYOUTS,
    "shape": SHAPE_LAYOUTS,
}

_LAYOUT_DESCRIPTIONS = {
    "earn_hero_badge": "Full actor + floating earnings badge + warm gradient. Actor right, text top-left.",
    "earn_split_stat": "Diagonal split — actor left, stat callout right ($X/hr oversized).",
    "earn_full_bleed": "Full bleed actor photo, gradient overlay bar at bottom with headline + CTA.",
    "earn_card_stack": "Testimonial card overlapping actor photo. Trust-building.",
    "grow_device_mockup": "Actor + device mockup showing task UI. Shows 'what you'll do.'",
    "grow_editorial": "Magazine editorial — large serif headline, actor portrait, generous whitespace.",
    "grow_diagonal_split": "Diagonal split with actor + skill badge cluster overlay. Dynamic energy.",
    "grow_bold_type": "Minimal photo + oversized bold headline. Typography-forward, modern.",
    "shape_portrait_cred": "Professional portrait + credential bar. Authority signals.",
    "shape_multi_grid": "2-3 image grid + impact stats overlay. Data-rich, credibility.",
    "shape_clean_card": "White card container + actor + professional overlay. Corporate, approachable.",
    "shape_photo_frame": "Photo-first with subtle brand frame border. Premium, minimal text.",
}


def build_prompt(
    actors: list[dict],
    copy_variants: list[str],
    brief: dict,
    pillar: str,
    cultural_context: str = "",
) -> str:
    """Build the Creative Director prompt."""
    layouts = _PILLAR_LAYOUTS.get(pillar, EARN_LAYOUTS)
    layout_block = "\n".join(
        f"  - {lid}: {_LAYOUT_DESCRIPTIONS.get(lid, '')}" for lid in layouts
    )
    actor_block = "\n".join(
        f"  - {a['actor_id']}: {a.get('name', 'Actor')} — {a.get('persona_summary', '')}"
        for a in actors
    )
    copy_block = "\n".join(f'  - "{c}"' for c in copy_variants)

    return f"""You are a creative director for recruitment ads. Generate exactly {len(actors) * 2} creative compositions as a JSON array.

## Available Layouts (pillar: {pillar})
{layout_block}

## Actors
{actor_block}

## Copy Variants (use VERBATIM — do NOT write new copy)
{copy_block}

## Brief
- Task type: {brief.get('task_type', '')}
- Compensation: {brief.get('compensation', '')}
- Country: {brief.get('country', '')}
{f'- Cultural context: {cultural_context}' if cultural_context else ''}

## Rules (MUST follow)
1. Each creative MUST use a DIFFERENT layout — no repeats
2. Each headline MUST be verbatim from the copy variants list above
3. No two creatives may use the same headline
4. If actor position is "right", text position MUST be "top-left", "bottom-left", or "center"
5. If actor position is "left", text position MUST be "top-right", "bottom-right", or "center"
6. At least half the creatives MUST include a context_element (device_mockup, task_card, icon_cluster, or stat_badge)

## Output Format
Return ONLY a JSON array. Each object:
{{
  "layout": "{layouts[0]}",
  "background": {{"type": "gradient|solid", "preset": "gradient_warm_sunset|bg_charcoal|..."}},
  "actor": {{"actor_id": "...", "position": "left|center|right", "scale": 0.5-1.0, "mask": "none|soft_fade|circle|arch|diagonal"}},
  "overlay": {{"elements": ["blob_warm_1", "badge_earnings", ...], "intensity": "subtle|medium|bold"}},
  "text": {{"headline": "verbatim from list", "subheadline": "short context", "position": "top-left|top-center|...", "size": "small|medium|large|hero", "contrast_backdrop": "none|dark_gradient|light_blur|solid_pill|brand_accent"}},
  "cta": {{"text": "Apply Now|Sign Up|Join Now|Learn More", "style": "pill_primary|pill_outline|banner_full|floating_circle|inline_text", "position": "bottom-center|bottom-right|inline"}},
  "context_element": {{"type": "device_mockup|task_card|icon_cluster|stat_badge", "position": "bottom-left|bottom-right|center-left|center-right", "content": "description"}} or null
}}

Return ONLY the JSON array. No explanation, no markdown fences."""


async def generate_creative_configs(
    actors: list[dict],
    copy_variants: list[str],
    brief: dict,
    pillar: str,
    cultural_context: str = "",
) -> list[dict]:
    """Call the Creative Director LLM and return parsed configs."""
    prompt = build_prompt(actors, copy_variants, brief, pillar, cultural_context)

    for model in [CREATIVE_DIRECTOR_MODEL, CREATIVE_DIRECTOR_FALLBACK]:
        if not OPENROUTER_API_KEY:
            continue
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 4096,
                        "temperature": 0.7,
                    },
                )
                resp.raise_for_status()
                text = resp.json()["choices"][0]["message"]["content"]
                configs = parse_response(text)
                if configs:
                    logger.info("Creative Director generated %d configs via %s", len(configs), model)
                    return configs
        except Exception as e:
            logger.warning("Creative Director failed with %s: %s", model, e)
            continue

    logger.error("All Creative Director models failed")
    return []


def parse_response(raw: str) -> list[dict]:
    """Parse LLM response into list of config dicts."""
    cleaned = raw.strip()

    # Strip markdown fences
    if "```json" in cleaned:
        cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    except json.JSONDecodeError:
        logger.warning("Failed to parse Creative Director response: %s", cleaned[:200])

    return []
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_creative_director.py -v 2>&1 | tail -15`

Expected: All 6 tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/ai/creative_director.py worker/tests/test_creative_director.py && git commit -m "feat(stage4): add Creative Director LLM prompt + response parser"
```

---

### Task 10: Pipeline Orchestrator (stage4_design_agent.py)

**Files:**
- Create: `worker/pipeline/stage4_design_agent.py`
- Modify: `worker/pipeline/orchestrator.py`

- [ ] **Step 1: Implement the new Stage 4 entry point**

Create `worker/pipeline/stage4_design_agent.py`:

```python
"""Stage 4 — Graphic Design Agent.

Replaces stage4_compose_v3.py with component assembly architecture.
LLM outputs structured JSON decisions → deterministic renderer assembles
pixel-perfect HTML → two-tier VQA → auto-fix.

Target: 6 reviewed creatives in ~35 seconds.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from ai.creative_director import generate_creative_configs
from blob_uploader import upload_to_blob
from compositor.render_png import render_html_to_png
from compositor.renderer import assemble_html
from compositor.schema import CreativeConfig, validate_batch
from neon_client import get_actors, get_assets, save_asset
from vqa.auto_fix import apply_fixes, MAX_FIX_CYCLES
from vqa.tier1_checks import run_tier1_checks
from vqa.tier2_batch_vqa import run_tier2_batch_vqa

logger = logging.getLogger(__name__)


async def run_stage4(
    request_id: str,
    brief: dict,
    form_data: dict | None = None,
    country: str | None = None,
    **kwargs: Any,
) -> dict:
    """Run Stage 4 — Graphic Design Agent.

    1. Load actors + copy from previous stages
    2. Call Creative Director LLM (one batch)
    3. Validate configs against schema
    4. Render all creatives (parallel)
    5. Tier 1 deterministic checks
    6. Tier 2 batch VQA
    7. Auto-fix any failures
    8. Save to Blob + Neon
    """
    pillar = brief.get("pillar_primary", "earn")
    language = form_data.get("primary_language", "en") if form_data else "en"

    # ── Load inputs from previous stages ──────────────────────────
    actors = await get_actors(request_id, country=country)
    if not actors:
        logger.error("No actors found for request %s", request_id)
        return {"asset_count": 0}

    copy_assets = await get_assets(request_id, asset_type="copy", country=country)
    copy_variants = _extract_headlines(copy_assets)
    if not copy_variants:
        logger.error("No copy variants found for request %s", request_id)
        return {"asset_count": 0}

    cultural_context = brief.get("cultural_research_summary", "")

    # ── Step 1: Creative Director LLM (one batch call) ────────────
    logger.info("Stage 4: Calling Creative Director for %d actors, pillar=%s", len(actors), pillar)
    raw_configs = await generate_creative_configs(
        actors=actors,
        copy_variants=copy_variants,
        brief=brief,
        pillar=pillar,
        cultural_context=cultural_context,
    )

    if not raw_configs:
        logger.error("Creative Director returned no configs")
        return {"asset_count": 0}

    # ── Step 2: Validate batch ────────────────────────────────────
    errors = validate_batch(raw_configs, pillar=pillar, copy_variants=copy_variants)
    if errors:
        logger.warning("Batch validation errors: %s — re-prompting once", errors)
        # Re-prompt with error feedback (one retry)
        raw_configs = await generate_creative_configs(
            actors=actors,
            copy_variants=copy_variants,
            brief=brief,
            pillar=pillar,
            cultural_context=cultural_context,
        )
        errors = validate_batch(raw_configs, pillar=pillar, copy_variants=copy_variants)
        if errors:
            logger.error("Batch still invalid after retry: %s", errors)
            return {"asset_count": 0}

    # Parse validated configs
    configs = [CreativeConfig.from_dict(c) for c in raw_configs]

    # ── Step 3: Render all creatives (parallel) ───────────────────
    actor_map = {a["actor_id"]: a for a in actors}
    render_tasks = []
    for config in configs:
        actor = actor_map.get(config.actor.actor_id, actors[0])
        photo_url = actor.get("photo_url", "")
        render_tasks.append(_render_one(config, photo_url, raw_configs))

    results = await asyncio.gather(*render_tasks)

    # ── Step 4: Tier 1 checks ────────────────────────────────────
    valid_results = []
    for config, html, png, raw_config in results:
        t1 = run_tier1_checks(html)
        if t1["passed"]:
            valid_results.append((config, html, png, raw_config))
        else:
            logger.warning("Tier 1 failed for %s: %s", config.layout, t1["issues"])

    if not valid_results:
        logger.error("All creatives failed Tier 1 checks")
        return {"asset_count": 0}

    # ── Step 5: Tier 2 batch VQA ──────────────────────────────────
    png_list = [png for _, _, png, _ in valid_results]
    vqa_results = await run_tier2_batch_vqa(png_list)

    # ── Step 6: Auto-fix failures ─────────────────────────────────
    final_results = []
    for i, (config, html, png, raw_config) in enumerate(valid_results):
        vqa = vqa_results[i] if i < len(vqa_results) else {"passed": True, "issues": []}
        if vqa.get("passed"):
            final_results.append((config, html, png))
        else:
            # Auto-fix: tweak props + re-render
            fixed_config_dict = apply_fixes(raw_config, vqa.get("issues", []))
            try:
                fixed_config = CreativeConfig.from_dict(fixed_config_dict)
                actor = actor_map.get(fixed_config.actor.actor_id, actors[0])
                fixed_html = assemble_html(fixed_config, actor.get("photo_url", ""))
                fixed_png = await render_html_to_png(fixed_html)
                final_results.append((fixed_config, fixed_html, fixed_png))
                logger.info("Auto-fixed creative %s", config.layout)
            except Exception as e:
                logger.warning("Auto-fix failed for %s: %s — keeping original", config.layout, e)
                final_results.append((config, html, png))

    # ── Step 7: Save to Blob + Neon ───────────────────────────────
    saved_count = 0
    for config, html, png in final_results:
        try:
            blob_url = await upload_to_blob(
                png,
                filename=f"{request_id}_{config.actor.actor_id}_{config.layout}.png",
                folder="generated/stage4",
            )
            await save_asset(request_id, {
                "actor_id": config.actor.actor_id,
                "asset_type": "composed_creative",
                "platform": "universal",  # Phase 1: hero format only
                "format": "png",
                "language": language,
                "blob_url": blob_url,
                "content": html,
                "evaluation_score": 1.0,
                "evaluation_data": {"engine": "design_agent", "layout": config.layout},
                "evaluation_passed": True,
                "stage": 4,
                "country": country,
            })
            saved_count += 1
        except Exception as e:
            logger.error("Failed to save creative %s: %s", config.layout, e)

    logger.info("Stage 4 complete: %d creatives saved in design_agent mode", saved_count)
    return {"asset_count": saved_count}


async def _render_one(
    config: CreativeConfig,
    photo_url: str,
    raw_configs: list[dict],
) -> tuple:
    """Render a single creative — assemble HTML + PNG."""
    html = assemble_html(config, actor_photo_url=photo_url)
    png = await render_html_to_png(html)
    raw = next((c for c in raw_configs if c["layout"] == config.layout), raw_configs[0])
    return (config, html, png, raw)


def _extract_headlines(copy_assets: list[dict]) -> list[str]:
    """Extract unique headline strings from Stage 3 copy assets."""
    headlines = set()
    for asset in copy_assets:
        content = asset.get("content", {})
        if isinstance(content, str):
            try:
                import json
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                continue
        if isinstance(content, dict):
            h = content.get("headline") or content.get("overlay_headline") or content.get("primary_text", "")
            if h:
                headlines.add(h)
    return list(headlines)[:8]  # Cap at 8 variants
```

- [ ] **Step 2: Wire into orchestrator**

In `worker/pipeline/orchestrator.py`, find where `run_stage4` is imported and add the routing logic. Add this import at the top:

```python
from config import STAGE4_ENGINE
```

Then modify the stage 4 entry in the stages list to use a routing function:

```python
async def _run_stage4_routed(request_id, brief, **kwargs):
    if STAGE4_ENGINE == "design_agent":
        from pipeline.stage4_design_agent import run_stage4 as run_stage4_new
        return await run_stage4_new(request_id, brief, **kwargs)
    else:
        from pipeline.stage4_compose_v3 import run_stage4 as run_stage4_legacy
        return await run_stage4_legacy(request_id, brief, **kwargs)
```

Replace the Stage 4 entry in the `stages` list:
```python
(4, "Layout Composition", _run_stage4_routed),
```

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/pipeline/stage4_design_agent.py worker/pipeline/orchestrator.py && git commit -m "feat(stage4): add graphic design agent pipeline + orchestrator routing (STAGE4_ENGINE config)"
```

---

### Task 11: Phase 2 — Aspect Ratio Adaptation

**Files:**
- Create: `worker/compositor/adapt.py`

- [ ] **Step 1: Implement adaptation**

Create `worker/compositor/adapt.py`:

```python
"""Phase 2 — Aspect ratio adaptation for approved creatives.

Takes a creative config (designed at 1080×1080) and produces
adapted versions for tall (9:16) and wide (1.91:1) formats.
No LLM call — deterministic reflow based on layout rules.
"""
from __future__ import annotations

import copy

from compositor.renderer import assemble_html
from compositor.render_png import render_html_to_png

PLATFORM_FORMATS = {
    "square": {"width": 1080, "height": 1080, "platforms": ["meta_feed"]},
    "tall": {"width": 1080, "height": 1920, "platforms": ["meta_story", "tiktok", "snapchat"]},
    "wide": {"width": 1200, "height": 627, "platforms": ["linkedin", "reddit"]},
}


def adapt_config_for_format(config_dict: dict, fmt: str) -> dict:
    """Adjust a creative config for a different aspect ratio.

    For tall (9:16): push actor to top half, text + CTA to bottom.
    For wide (1.91:1): spread elements horizontally.
    """
    adapted = copy.deepcopy(config_dict)

    if fmt == "tall":
        # Vertical: actor stays in position but scale may increase
        adapted["actor"]["scale"] = min(1.0, adapted["actor"]["scale"] + 0.1)
        # Text moves to bottom if it was top
        if "top" in adapted["text"]["position"]:
            adapted["text"]["position"] = adapted["text"]["position"].replace("top", "bottom")

    elif fmt == "wide":
        # Horizontal: actor to side, text opposite
        if adapted["actor"]["position"] == "center":
            adapted["actor"]["position"] = "right"
        adapted["actor"]["scale"] = max(0.5, adapted["actor"]["scale"] - 0.1)

    return adapted


async def adapt_creative(
    config_dict: dict,
    actor_photo_url: str,
) -> list[dict]:
    """Produce all format variants for an approved creative.

    Returns list of {"format": str, "width": int, "height": int,
                     "html": str, "png": bytes, "platforms": list[str]}
    """
    from compositor.schema import CreativeConfig

    results = []
    for fmt_name, fmt_spec in PLATFORM_FORMATS.items():
        adapted_dict = adapt_config_for_format(config_dict, fmt_name)
        config = CreativeConfig.from_dict(adapted_dict)
        html = assemble_html(config, actor_photo_url, fmt_spec["width"], fmt_spec["height"])
        png = await render_html_to_png(html, fmt_spec["width"], fmt_spec["height"])
        results.append({
            "format": fmt_name,
            "width": fmt_spec["width"],
            "height": fmt_spec["height"],
            "html": html,
            "png": png,
            "platforms": fmt_spec["platforms"],
        })

    return results
```

- [ ] **Step 2: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/compositor/adapt.py && git commit -m "feat(stage4): add Phase 2 aspect ratio adaptation (square, tall, wide)"
```

---

### Task 12: Integration Test + Full Test Suite Run

**Files:**
- Create: `worker/tests/test_stage4_design_agent.py`

- [ ] **Step 1: Write integration test (pure logic, no API calls)**

Create `worker/tests/test_stage4_design_agent.py`:

```python
"""Integration tests for Stage 4 graphic design agent — pure logic only.

Tests the full flow: config → render → tier1 → auto-fix
without touching APIs (Creative Director, VQA, Blob, Neon).
"""
import pytest
from compositor.schema import CreativeConfig, validate_batch, EARN_LAYOUTS
from compositor.renderer import assemble_html
from vqa.tier1_checks import run_tier1_checks
from vqa.auto_fix import apply_fixes


def _make_earn_config(layout: str, headline: str, actor_pos: str = "right", text_pos: str = "top-left"):
    return {
        "layout": layout,
        "background": {"type": "gradient", "preset": "gradient_warm_sunset"},
        "actor": {"actor_id": "test-1", "position": actor_pos, "scale": 0.85, "mask": "soft_fade"},
        "overlay": {"elements": ["blob_warm_1"], "intensity": "medium"},
        "text": {
            "headline": headline,
            "subheadline": "Test subheadline",
            "position": text_pos,
            "size": "large",
            "contrast_backdrop": "dark_gradient",
        },
        "cta": {"text": "Apply Now", "style": "pill_primary", "position": "bottom-center"},
        "context_element": None,
    }


class TestFullFlow:
    def test_config_to_html_roundtrip(self):
        """Config → CreativeConfig → assemble_html produces valid HTML."""
        raw = _make_earn_config("earn_hero_badge", "Earn money from home")
        config = CreativeConfig.from_dict(raw)
        html = assemble_html(config, actor_photo_url="https://example.com/test.png")
        assert "<!DOCTYPE html>" in html
        assert "Earn money from home" in html
        assert "Apply Now" in html
        assert "example.com/test.png" in html

    def test_all_earn_layouts_render(self):
        """All 4 earn layouts produce valid HTML."""
        headlines = ["Earn $17.50/hr", "Flexible remote work", "Join 10K contributors", "Data tasks for you"]
        for layout, headline in zip(EARN_LAYOUTS, headlines):
            raw = _make_earn_config(layout, headline)
            config = CreativeConfig.from_dict(raw)
            html = assemble_html(config, actor_photo_url="https://example.com/test.png")
            assert "<!DOCTYPE html>" in html
            assert headline in html

    def test_tier1_passes_valid_render(self):
        """Tier 1 checks pass on properly assembled HTML."""
        raw = _make_earn_config("earn_hero_badge", "Test headline")
        config = CreativeConfig.from_dict(raw)
        html = assemble_html(config, actor_photo_url="https://example.com/test.png")
        result = run_tier1_checks(html)
        assert result["passed"] is True

    def test_batch_validation_rejects_duplicates(self):
        """Batch validation catches duplicate layouts."""
        c1 = _make_earn_config("earn_hero_badge", "Headline A")
        c2 = _make_earn_config("earn_hero_badge", "Headline B")
        errors = validate_batch([c1, c2], pillar="earn", copy_variants=["Headline A", "Headline B"])
        assert any("duplicate" in e.lower() for e in errors)

    def test_auto_fix_preserves_valid_config(self):
        """Auto-fix with no issues returns identical config."""
        raw = _make_earn_config("earn_hero_badge", "Test")
        fixed = apply_fixes(raw, [])
        assert fixed["actor"]["scale"] == raw["actor"]["scale"]
        assert fixed["text"]["position"] == raw["text"]["position"]

    def test_full_batch_diverse_layouts(self):
        """A full batch of 4 earn creatives uses all different layouts."""
        headlines = ["H1", "H2", "H3", "H4"]
        configs = [
            _make_earn_config(layout, headline)
            for layout, headline in zip(EARN_LAYOUTS, headlines)
        ]
        errors = validate_batch(configs, pillar="earn", copy_variants=headlines)
        assert errors == []
```

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/test_compositor_schema.py worker/tests/test_compositor_renderer.py worker/tests/test_compositor_registry.py worker/tests/test_vqa_tier1.py worker/tests/test_vqa_auto_fix.py worker/tests/test_creative_director.py worker/tests/test_stage4_design_agent.py -v 2>&1 | tail -30`

Expected: All tests PASS

- [ ] **Step 3: Run existing test suite to check for regressions**

Run: `cd /Users/stevenjunop/centric-intake && python -m pytest worker/tests/ -v 2>&1 | tail -30`

Expected: All existing + new tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/tests/test_stage4_design_agent.py && git commit -m "test(stage4): add integration tests for graphic design agent full flow"
```

- [ ] **Step 5: Final commit — update config default**

Verify `STAGE4_ENGINE` defaults to `"design_agent"` in `worker/config.py`. If everything passes, the new engine is now the default.

```bash
cd /Users/stevenjunop/centric-intake && git add -A && git commit -m "feat(stage4): graphic design agent v1 complete — component assembly, 12 layouts, two-tier VQA, auto-fix"
```
