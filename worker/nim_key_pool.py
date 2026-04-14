"""NIM API key pool — round-robin rotation across multiple keys.

NIM free tier: 40 RPM per key. With N keys we get N × 40 RPM.
Call get_nim_key() to get the next key in rotation.
"""
import itertools
import os
import logging

from dotenv import load_dotenv
load_dotenv()  # Ensure .env is loaded before reading keys

logger = logging.getLogger(__name__)

# Collect all NIM keys from environment
_ALL_KEYS = []

# Primary key
_primary = os.environ.get("NVIDIA_NIM_API_KEY", "")
if _primary:
    _ALL_KEYS.append(_primary)

# VQA key (different account)
_vqa = os.environ.get("NVIDIA_NIM_VQA_KEY", "")
if _vqa and _vqa != _primary:
    _ALL_KEYS.append(_vqa)

# Additional keys from NIM_EXTRA_KEYS (comma-separated)
_extra = os.environ.get("NIM_EXTRA_KEYS", "")
if _extra:
    for k in _extra.split(","):
        k = k.strip()
        if k and k not in _ALL_KEYS:
            _ALL_KEYS.append(k)

# Numbered keys: NIM_KEY_1, NIM_KEY_2, ..., NIM_KEY_20
for i in range(1, 21):
    k = os.environ.get(f"NIM_KEY_{i}", "")
    if k and k not in _ALL_KEYS:
        _ALL_KEYS.append(k)

_cycle = itertools.cycle(_ALL_KEYS) if _ALL_KEYS else None

logger.info("NIM key pool: %d keys loaded (%d RPM capacity)", len(_ALL_KEYS), len(_ALL_KEYS) * 40)


def get_nim_key() -> str:
    """Get the next NIM API key from the round-robin pool."""
    if _cycle is None:
        return ""
    return next(_cycle)


def get_all_nim_keys() -> list[str]:
    """Get all keys (for parallel dispatch)."""
    return list(_ALL_KEYS)


def key_count() -> int:
    """Number of keys in the pool."""
    return len(_ALL_KEYS)
