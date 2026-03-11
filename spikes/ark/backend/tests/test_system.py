"""Tests for the Ark system function group (real-filesystem variant)."""

import pytest

from ark_backend.system import get_ark_system_group
from opal_backend.function_definition import FunctionGroup
from opal_backend.loop import LoopController


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop_status_cb(status=None, opts=None):
    pass


def _get_handler(group: FunctionGroup, name: str):
    for fn_name, fn_def in group.definitions:
        if fn_name == name:
            return fn_def.handler
    raise KeyError(f"Handler '{name}' not found in group")


# ---------------------------------------------------------------------------
# FunctionGroup construction
# ---------------------------------------------------------------------------


def test_group_has_seven_declarations(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    assert isinstance(group, FunctionGroup)
    assert len(group.declarations) == 7
    names = [d["name"] for d in group.declarations]
    assert "system_objective_fulfilled" in names
    assert "system_failed_to_fulfill_objective" in names
    assert "system_list_files" in names
    assert "system_write_file" in names
    assert "system_read_text_from_file" in names
    assert "system_create_task_tree" in names
    assert "system_mark_completed_tasks" in names


def test_group_has_instruction(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    assert group.instruction
    assert "objective" in group.instruction.lower()


# ---------------------------------------------------------------------------
# Termination handlers
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_objective_fulfilled_terminates(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    handler = _get_handler(group, "system_objective_fulfilled")

    assert not controller.terminated
    await handler(
        {"objective_outcome": "Done!", "href": "/"},
        _noop_status_cb,
    )
    assert controller.terminated
    assert controller.result.success is True
    assert controller.result.outcomes["parts"][0]["text"] == "Done!"


@pytest.mark.asyncio
async def test_failed_to_fulfill_terminates(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    handler = _get_handler(group, "system_failed_to_fulfill_objective")

    await handler(
        {"user_message": "Cannot proceed", "href": "/"},
        _noop_status_cb,
    )
    assert controller.terminated
    assert controller.result.success is False


# ---------------------------------------------------------------------------
# File operation handlers
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_write_and_read_file(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    write = _get_handler(group, "system_write_file")
    read = _get_handler(group, "system_read_text_from_file")

    result = await write(
        {"file_name": "hello.txt", "content": "world"},
        _noop_status_cb,
    )
    assert "error" not in result
    assert result["file_path"] == "hello.txt"

    # File exists on disk.
    assert (tmp_path / "hello.txt").read_text() == "world"

    # Read it back.
    result = await read({"file_path": "hello.txt"}, _noop_status_cb)
    assert result["text"] == "world"


@pytest.mark.asyncio
async def test_list_files(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    write = _get_handler(group, "system_write_file")
    list_files = _get_handler(group, "system_list_files")

    # Empty directory.
    result = await list_files({"status_update": "checking"}, _noop_status_cb)
    assert result["list"] == "(empty)"

    # Write two files.
    await write({"file_name": "a.txt", "content": "a"}, _noop_status_cb)
    await write({"file_name": "b.txt", "content": "b"}, _noop_status_cb)

    result = await list_files({"status_update": "checking"}, _noop_status_cb)
    assert "a.txt" in result["list"]
    assert "b.txt" in result["list"]


@pytest.mark.asyncio
async def test_read_nonexistent_file(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    read = _get_handler(group, "system_read_text_from_file")

    result = await read({"file_path": "missing.txt"}, _noop_status_cb)
    assert "error" in result
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_path_traversal_blocked(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    write = _get_handler(group, "system_write_file")
    read = _get_handler(group, "system_read_text_from_file")

    # Write outside work_dir.
    result = await write(
        {"file_name": "../../escape.txt", "content": "bad"},
        _noop_status_cb,
    )
    assert "error" in result

    # Read outside work_dir.
    result = await read({"file_path": "../../etc/passwd"}, _noop_status_cb)
    assert "error" in result


@pytest.mark.asyncio
async def test_subdirectory_write(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    write = _get_handler(group, "system_write_file")

    result = await write(
        {"file_name": "sub/dir/file.txt", "content": "nested"},
        _noop_status_cb,
    )
    assert "error" not in result
    assert (tmp_path / "sub" / "dir" / "file.txt").read_text() == "nested"


@pytest.mark.asyncio
async def test_intermediate_files_collected(tmp_path):
    """system_objective_fulfilled collects files from work_dir."""
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    write = _get_handler(group, "system_write_file")
    fulfill = _get_handler(group, "system_objective_fulfilled")

    await write({"file_name": "out.txt", "content": "result"}, _noop_status_cb)
    await fulfill(
        {"objective_outcome": "Here it is", "href": "/"},
        _noop_status_cb,
    )

    assert controller.terminated
    intermediate = controller.result.intermediate
    assert intermediate is not None
    paths = [f.path for f in intermediate]
    assert "out.txt" in paths


@pytest.mark.asyncio
async def test_create_and_mark_task_tree(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    create = _get_handler(group, "system_create_task_tree")
    mark = _get_handler(group, "system_mark_completed_tasks")

    tree = {
        "task_id": "task_001",
        "description": "Root",
        "execution_mode": "serial",
        "status": "not_started",
        "subtasks": [
            {
                "task_id": "task_002",
                "description": "Sub",
                "execution_mode": "serial",
                "status": "not_started",
            }
        ],
    }

    result = await create({"task_tree": tree}, _noop_status_cb)
    assert result["file_path"] == "task_tree.json"
    assert (tmp_path / "task_tree.json").exists()

    result = await mark({"task_ids": ["task_002"]}, _noop_status_cb)
    assert "error" not in result

    import json
    saved = json.loads((tmp_path / "task_tree.json").read_text())
    assert saved["subtasks"][0]["status"] == "complete"
    assert saved["status"] == "not_started"  # root unchanged


@pytest.mark.asyncio
async def test_mark_without_tree_errors(tmp_path):
    controller = LoopController()
    group = get_ark_system_group(controller, work_dir=tmp_path)
    mark = _get_handler(group, "system_mark_completed_tasks")

    result = await mark({"task_ids": ["task_001"]}, _noop_status_cb)
    assert "error" in result
