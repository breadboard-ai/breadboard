"""Tests for task cancellation on server shutdown."""

import asyncio
from dataclasses import field

import pytest

from ark_backend.main import Run, _cancel_running_tasks, runs


@pytest.fixture(autouse=True)
def clean_runs():
    """Ensure the global runs dict is clean between tests."""
    runs.clear()
    yield
    runs.clear()


@pytest.mark.asyncio
async def test_shutdown_cancels_running_task():
    """A running task should be cancelled on shutdown."""
    started = asyncio.Event()
    cancelled = False

    async def long_running():
        nonlocal cancelled
        started.set()
        try:
            await asyncio.sleep(999)
        except asyncio.CancelledError:
            cancelled = True
            raise

    run = Run(id="test-1", objective="test", agent_type="bash")
    run.task = asyncio.create_task(long_running())
    runs["test-1"] = run

    # Wait for the task to actually start.
    await started.wait()
    assert not run.task.done()

    # Trigger the shutdown handler.
    await _cancel_running_tasks()

    # Give the event loop a tick for cancellation to propagate.
    await asyncio.sleep(0)

    assert cancelled
    assert run.task.done()


@pytest.mark.asyncio
async def test_shutdown_skips_completed_tasks():
    """A completed task should not raise when shutdown runs."""
    async def quick():
        return

    run = Run(id="test-2", objective="test", agent_type="bash")
    run.task = asyncio.create_task(quick())
    runs["test-2"] = run

    # Wait for completion.
    await run.task

    # Should not raise.
    await _cancel_running_tasks()
    assert run.task.done()


@pytest.mark.asyncio
async def test_shutdown_handles_no_task():
    """Runs without a task field (e.g., hydrated from disk) should not crash."""
    run = Run(id="test-3", objective="test", agent_type="bash")
    assert run.task is None
    runs["test-3"] = run

    # Should not raise.
    await _cancel_running_tasks()
