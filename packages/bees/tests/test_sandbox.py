# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the sandbox function group write restrictions."""

from __future__ import annotations

import os
import platform
import shutil
from pathlib import Path
import pytest
from unittest.mock import MagicMock

from bees.functions.sandbox import get_sandbox_function_group_factory
from bees.subagent_scope import SubagentScope


@pytest.mark.asyncio
async def test_sandbox_restricts_writes_to_slug(monkeypatch):
    if platform.system() != "Darwin" or not shutil.which("sandbox-exec"):
        pytest.skip("sandbox-exec only available on macOS")
        
    import asyncio
    from unittest.mock import AsyncMock
    
    mock_create = AsyncMock()
    mock_proc = MagicMock()
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))
    mock_proc.returncode = 0
    mock_create.return_value = mock_proc
    
    monkeypatch.setattr(asyncio, "create_subprocess_exec", mock_create)
    
    work_dir = Path("/tmp/fake-work")
    scope = SubagentScope(workspace_root_id="r", slug_path="my-slug")
    
    from bees.functions.sandbox import _make_handlers
    handlers = _make_handlers(work_dir=work_dir, scope=scope)
    
    execute_bash = handlers["execute_bash"]
    
    args = {"command": "echo 'hello'"}
    await execute_bash(args, None)
    
    assert mock_create.called
    call_args, _ = mock_create.call_args
    
    assert call_args[0] == "sandbox-exec"
    assert call_args[1] == "-p"
    profile = call_args[2]
    
    # Verify that the profile restricts writes to the slug directory!
    assert f'(subpath "{work_dir / "my-slug"}")' in profile
    # And not the base work_dir!
    assert f'(subpath "{work_dir}")' not in profile


@pytest.mark.asyncio
async def test_files_restricts_writes_to_slug():
    from bees.functions.files import get_files_function_group_factory
    from unittest.mock import MagicMock
    
    slug = "my-slug"
    scope = SubagentScope(workspace_root_id="r", slug_path=slug)
    factory = get_files_function_group_factory(scope=scope)
    
    mock_hooks = MagicMock()
    mock_hooks.file_system = MagicMock()
    mock_hooks.file_system.write = MagicMock(return_value="slug/file.txt")
    
    fg = factory(mock_hooks)
    
    # Find files_write_file handler
    write_handler = None
    for name, defn in fg.definitions:
        if name == "files_write_file":
            write_handler = defn.handler
            break
            
    assert write_handler is not None
    
    # 1. Try to write INSIDE slug (should succeed)
    args = {"file_name": f"{slug}/allowed.txt", "content": "hello"}
    result = await write_handler(args, None)
    assert "error" not in result
    mock_hooks.file_system.write.assert_called_once_with(f"{slug}/allowed.txt", "hello")
    
    # 2. Try to write OUTSIDE slug (should fail)
    mock_hooks.file_system.write.reset_mock()
    args = {"file_name": "forbidden.txt", "content": "hello"}
    result = await write_handler(args, None)
    assert "error" in result
    assert "You can only write files in the directory" in result["error"]
    assert not mock_hooks.file_system.write.called
