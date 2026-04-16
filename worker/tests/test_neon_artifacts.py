"""Smoke tests for design artifact Neon client methods."""

import asyncio

import neon_client
import pytest
from neon_client import delete_artifact, get_active_artifacts, upsert_artifact


# Single event loop for the whole module — asyncpg pool is loop-bound,
# so sharing one loop avoids "Future attached to a different loop" errors.
@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    # Close the pool before closing the loop so asyncpg can cleanly shut down.
    if neon_client._pool is not None:
        loop.run_until_complete(neon_client._pool.close())
        neon_client._pool = None
    loop.close()


def test_get_active_artifacts_returns_list(event_loop):
    """get_active_artifacts should return a list (possibly empty)."""
    result = event_loop.run_until_complete(get_active_artifacts())
    assert isinstance(result, list)


def test_upsert_and_retrieve_artifact(event_loop):
    """Insert a test artifact, retrieve it, then clean up."""
    test_artifact = {
        "artifact_id": "_test_blob_1",
        "category": "blob",
        "description": "Test blob for automated testing",
        "blob_url": "https://example.com/test.svg",
        "dimensions": "100x100",
        "css_class": "test-blob",
        "usage_snippet": '<img src="https://example.com/test.svg" />',
        "usage_notes": "Test only",
        "pillar_affinity": ["earn"],
        "format_affinity": ["ig_feed"],
        "is_active": True,
    }

    # Insert
    result = event_loop.run_until_complete(upsert_artifact(test_artifact))
    assert result["artifact_id"] == "_test_blob_1"

    # Retrieve
    artifacts = event_loop.run_until_complete(get_active_artifacts())
    found = [a for a in artifacts if a["artifact_id"] == "_test_blob_1"]
    assert len(found) == 1
    assert found[0]["category"] == "blob"
    assert found[0]["description"] == "Test blob for automated testing"

    # Clean up — hard delete test row
    event_loop.run_until_complete(delete_artifact("_test_blob_1", hard=True))

    # Verify gone
    artifacts = event_loop.run_until_complete(get_active_artifacts())
    found = [a for a in artifacts if a["artifact_id"] == "_test_blob_1"]
    assert len(found) == 0


def test_delete_artifact_soft(event_loop):
    """Soft delete should set is_active=false, not remove the row."""
    test_artifact = {
        "artifact_id": "_test_blob_soft",
        "category": "blob",
        "description": "Test blob for soft delete",
        "blob_url": "https://example.com/test2.svg",
        "dimensions": "50x50",
        "css_class": "",
        "usage_snippet": '<img src="https://example.com/test2.svg" />',
        "usage_notes": "",
        "pillar_affinity": [],
        "format_affinity": [],
        "is_active": True,
    }

    event_loop.run_until_complete(upsert_artifact(test_artifact))

    # Soft delete
    event_loop.run_until_complete(delete_artifact("_test_blob_soft"))

    # Should not appear in active artifacts
    artifacts = event_loop.run_until_complete(get_active_artifacts())
    found = [a for a in artifacts if a["artifact_id"] == "_test_blob_soft"]
    assert len(found) == 0

    # Hard delete cleanup
    event_loop.run_until_complete(delete_artifact("_test_blob_soft", hard=True))
