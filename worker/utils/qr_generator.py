"""QR code generator with UTM tracking for flyers."""
from __future__ import annotations

import io
import base64
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer


def build_tracked_url(
    base_url: str,
    campaign_slug: str,
    locale: str,
    source: str = "flyer",
    medium: str = "print",
) -> str:
    """Build a URL with UTM parameters for tracking."""
    utm_params = {
        "utm_source": source,
        "utm_medium": medium,
        "utm_campaign": campaign_slug,
        "utm_content": locale,
    }
    parsed = urlparse(base_url)
    existing_params = parse_qs(parsed.query)
    existing_params.update(utm_params)
    new_query = urlencode(existing_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def generate_qr_code(
    url: str,
    size: int = 300,
    border: int = 2,
) -> str:
    """Generate a QR code as a base64-encoded PNG data URI.

    Returns a data URI string suitable for embedding in HTML:
    data:image/png;base64,...
    """
    qr = qrcode.QRCode(
        version=None,  # auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=border,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
    )

    # Resize to target dimensions
    img = img.resize((size, size))

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    b64 = base64.b64encode(buffer.read()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def resolve_qr_destination(form_data: dict, locale: str = "") -> str:
    """Resolve QR code destination: Aidaform first, fallback to job posting.

    Priority:
    1. ada_form_url from form_data (if exists)
    2. Locale-specific link from locale_links
    3. Generic job posting URL
    """
    # Priority 1: Aidaform
    ada_form_url = form_data.get("ada_form_url", "")
    if ada_form_url:
        return ada_form_url

    # Priority 2: Locale-specific link
    locale_links = form_data.get("locale_links", [])
    if locale_links:
        for link in locale_links:
            if link.get("label", "").lower() == locale.lower():
                return link["url"]
        # Fallback: first locale link
        if locale_links[0].get("url"):
            return locale_links[0]["url"]

    # Priority 3: WP job post URL (set by Stage 1)
    wp_url = form_data.get("wp_url", "")
    if wp_url:
        return wp_url

    return "https://www.oneforma.com/apply"
