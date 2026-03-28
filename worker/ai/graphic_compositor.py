"""Graphic design compositor for layered ad creatives.

Creates professional graphic design compositions where:
- Characters pop out of card borders (head/body overlapping frame edges)
- Background gradients or brand patterns sit behind the character
- Text elements and CTA buttons are layered around the cutout
- Multiple design elements compose into final ad creative

All using Pillow — free, local, no paid APIs.
"""
from __future__ import annotations

import io
import logging

from PIL import Image, ImageDraw, ImageFont, ImageFilter

logger = logging.getLogger(__name__)


class GraphicCompositor:
    """Builds layered graphic designs for recruitment ad creatives."""

    def __init__(self, width: int = 1080, height: int = 1080):
        self.width = width
        self.height = height
        self.canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    def add_gradient_background(
        self,
        colors: list[str] = ["#FFFFFF", "#F5F5F5"],
        direction: str = "vertical",
    ) -> "GraphicCompositor":
        """Add a gradient background layer."""
        from PIL import ImageColor

        gradient = Image.new("RGBA", (self.width, self.height))
        draw = ImageDraw.Draw(gradient)

        c1 = ImageColor.getrgb(colors[0])
        c2 = ImageColor.getrgb(colors[1])

        for i in range(self.height if direction == "vertical" else self.width):
            ratio = i / (self.height if direction == "vertical" else self.width)
            r = int(c1[0] + (c2[0] - c1[0]) * ratio)
            g = int(c1[1] + (c2[1] - c1[1]) * ratio)
            b = int(c1[2] + (c2[2] - c1[2]) * ratio)

            if direction == "vertical":
                draw.line([(0, i), (self.width, i)], fill=(r, g, b, 255))
            else:
                draw.line([(i, 0), (i, self.height)], fill=(r, g, b, 255))

        self.canvas = Image.alpha_composite(self.canvas, gradient)
        return self

    def add_card_frame(
        self,
        x: int = 40,
        y: int = 200,
        card_width: int = 1000,
        card_height: int = 700,
        color: str = "#FFFFFF",
        border_radius: int = 24,
        shadow: bool = True,
    ) -> "GraphicCompositor":
        """Add a card/panel that the character will pop out of."""
        from PIL import ImageColor

        card = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(card)

        # Shadow
        if shadow:
            shadow_layer = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow_layer)
            shadow_draw.rounded_rectangle(
                [x + 4, y + 4, x + card_width + 4, y + card_height + 4],
                radius=border_radius,
                fill=(0, 0, 0, 40),
            )
            shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(12))
            self.canvas = Image.alpha_composite(self.canvas, shadow_layer)

        # Card
        c = ImageColor.getrgb(color)
        draw.rounded_rectangle(
            [x, y, x + card_width, y + card_height],
            radius=border_radius,
            fill=(*c, 255),
        )
        self.canvas = Image.alpha_composite(self.canvas, card)
        return self

    def add_character_cutout(
        self,
        cutout_bytes: bytes,
        x: int = 100,
        y: int = 50,
        max_height: int = 900,
        pop_above_card: bool = True,
    ) -> "GraphicCompositor":
        """Add a character cutout that 'pops out' of the card frame.

        If pop_above_card=True, the character's head/upper body extends
        ABOVE the card boundary, creating the overlapping effect.
        """
        cutout = Image.open(io.BytesIO(cutout_bytes)).convert("RGBA")

        # Scale to fit
        aspect = cutout.width / cutout.height
        new_height = min(max_height, self.height - y)
        new_width = int(new_height * aspect)
        cutout = cutout.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Paste with alpha
        layer = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        layer.paste(cutout, (x, y), cutout)
        self.canvas = Image.alpha_composite(self.canvas, layer)
        return self

    def add_text(
        self,
        text: str,
        x: int = 40,
        y: int = 40,
        font_size: int = 48,
        color: str = "#1A1A1A",
        font_weight: str = "bold",
        max_width: int = 0,
    ) -> "GraphicCompositor":
        """Add text to the composition."""
        from PIL import ImageColor

        layer = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)

        # Try to use system font
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

        c = ImageColor.getrgb(color)

        # Word wrap if max_width specified
        if max_width > 0:
            words = text.split()
            lines: list[str] = []
            current_line = ""
            for word in words:
                test = f"{current_line} {word}".strip()
                bbox = draw.textbbox((0, 0), test, font=font)
                if bbox[2] - bbox[0] > max_width:
                    if current_line:
                        lines.append(current_line)
                    current_line = word
                else:
                    current_line = test
            if current_line:
                lines.append(current_line)

            for i, line in enumerate(lines):
                draw.text(
                    (x, y + i * (font_size + 8)),
                    line,
                    fill=(*c, 255),
                    font=font,
                )
        else:
            draw.text((x, y), text, fill=(*c, 255), font=font)

        self.canvas = Image.alpha_composite(self.canvas, layer)
        return self

    def add_cta_button(
        self,
        text: str = "Start Earning",
        x: int = 40,
        y: int = 900,
        width: int = 300,
        height: int = 56,
        bg_color: str = "#32373C",
        text_color: str = "#FFFFFF",
        border_radius: int = 9999,
    ) -> "GraphicCompositor":
        """Add a pill-shaped CTA button."""
        from PIL import ImageColor

        layer = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)

        bg = ImageColor.getrgb(bg_color)
        tc = ImageColor.getrgb(text_color)

        draw.rounded_rectangle(
            [x, y, x + width, y + height],
            radius=border_radius,
            fill=(*bg, 255),
        )

        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
        except (OSError, IOError):
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        text_x = x + (width - text_w) // 2
        text_y = y + (height - text_h) // 2
        draw.text((text_x, text_y), text, fill=(*tc, 255), font=font)

        self.canvas = Image.alpha_composite(self.canvas, layer)
        return self

    def add_logo(
        self,
        text: str = "OneForma",
        x: int = 40,
        y: int = 40,
        font_size: int = 24,
        color: str = "#32373C",
    ) -> "GraphicCompositor":
        """Add brand logo text."""
        return self.add_text(text, x=x, y=y, font_size=font_size, color=color)

    def add_badge(
        self,
        text: str = "Flexible Hours",
        x: int = 40,
        y: int = 100,
        bg_color: str = "#F0F0F0",
        text_color: str = "#32373C",
    ) -> "GraphicCompositor":
        """Add a small badge/pill label."""
        from PIL import ImageColor

        layer = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)

        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
        except (OSError, IOError):
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        padding_x, padding_y = 16, 8
        bg = ImageColor.getrgb(bg_color)
        tc = ImageColor.getrgb(text_color)

        draw.rounded_rectangle(
            [x, y, x + text_w + padding_x * 2, y + text_h + padding_y * 2],
            radius=20,
            fill=(*bg, 255),
        )
        draw.text(
            (x + padding_x, y + padding_y),
            text,
            fill=(*tc, 255),
            font=font,
        )

        self.canvas = Image.alpha_composite(self.canvas, layer)
        return self

    def render(self) -> bytes:
        """Render the final composition as PNG bytes."""
        buf = io.BytesIO()
        self.canvas.save(buf, format="PNG")
        return buf.getvalue()


# =========================================================================
# PRE-BUILT COMPOSITION TEMPLATES
# =========================================================================


async def compose_character_popout(
    cutout_bytes: bytes,
    headline: str,
    subheadline: str = "",
    cta_text: str = "Start Earning",
    brand_colors: list[str] = ["#FFFFFF", "#F5F5F5"],
    width: int = 1080,
    height: int = 1080,
) -> bytes:
    """Character popping out of a card -- the signature composition.

    The character's head and shoulders extend above the card boundary,
    creating a dynamic, professional 3D-like effect.
    """
    comp = GraphicCompositor(width, height)

    # Background gradient
    comp.add_gradient_background(colors=brand_colors)

    # Card that character pops out of
    card_y = height // 3
    comp.add_card_frame(
        x=40,
        y=card_y,
        card_width=width - 80,
        card_height=height - card_y - 120,
    )

    # Character overlapping the card (positioned so head is above card top edge)
    comp.add_character_cutout(
        cutout_bytes,
        x=width // 2 - 200,
        y=card_y - 250,  # Extends ABOVE the card
        max_height=int(height * 0.7),
    )

    # Logo
    comp.add_logo(x=60, y=card_y + 30)

    # Headline
    comp.add_text(
        headline,
        x=60,
        y=card_y + 80,
        font_size=42,
        max_width=width - 160,
    )

    # Subheadline
    if subheadline:
        comp.add_text(
            subheadline,
            x=60,
            y=card_y + 200,
            font_size=24,
            color="#737373",
            max_width=width - 160,
        )

    # CTA
    comp.add_cta_button(text=cta_text, x=60, y=height - 100)

    return comp.render()


async def compose_side_by_side(
    cutout_bytes: bytes,
    headline: str,
    badges: list[str] = [],
    cta_text: str = "Join Now",
    width: int = 1200,
    height: int = 627,
) -> bytes:
    """Character on one side, text on the other -- for landscape ads."""
    comp = GraphicCompositor(width, height)

    comp.add_gradient_background(colors=["#FFFFFF", "#FAFAFA"])

    # Text side (left)
    comp.add_logo(x=40, y=30)
    comp.add_text(headline, x=40, y=100, font_size=36, max_width=width // 2 - 60)

    for i, badge_text in enumerate(badges[:3]):
        comp.add_badge(badge_text, x=40, y=280 + i * 50)

    comp.add_cta_button(text=cta_text, x=40, y=height - 80)

    # Character side (right)
    comp.add_character_cutout(
        cutout_bytes,
        x=width // 2 + 50,
        y=20,
        max_height=height - 40,
    )

    return comp.render()
