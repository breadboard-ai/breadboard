# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import tempfile
from pathlib import Path
from unittest.mock import Mock, AsyncMock
import pytest
from bees import Bees
from bees.task_node import TaskNode


@pytest.fixture
def temp_hive():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def test_tree_traversal(temp_hive):
    bees = Bees(temp_hive, backend=Mock())
    store = bees._store

    # Create a tree structure
    # root1
    #   ├── child1
    #   │     └── grandchild1
    #   └── child2
    # root2

    root1 = store.create("Root 1")
    root2 = store.create("Root 2")

    child1 = store.create("Child 1", creator_ticket_id=root1.id)
    child2 = store.create("Child 2", creator_ticket_id=root1.id)

    grandchild1 = store.create("Grandchild 1", creator_ticket_id=child1.id)

    # Test get_children
    roots = bees.children
    assert len(roots) == 2
    root_ids = {r.id for r in roots}
    assert root_ids == {root1.id, root2.id}

    # Test children traversal
    root1_node = bees.get_by_id(root1.id)
    assert root1_node is not None
    children = root1_node.children
    assert len(children) == 2
    child_ids = {c.id for c in children}
    assert child_ids == {child1.id, child2.id}

    # Test parent traversal
    child1_node = bees.get_by_id(child1.id)
    assert child1_node is not None
    assert child1_node.parent is not None
    assert child1_node.parent.id == root1.id

    # Test deep traversal
    grandchild1_node = bees.get_by_id(grandchild1.id)
    assert grandchild1_node is not None
    assert grandchild1_node.parent is not None
    assert grandchild1_node.parent.id == child1.id
    assert grandchild1_node.parent.parent is not None
    assert grandchild1_node.parent.parent.id == root1.id

    # Test edge cases
    root2_node = bees.get_by_id(root2.id)
    assert root2_node is not None
    assert len(root2_node.children) == 0
    assert root2_node.parent is None


def test_empty_store(temp_hive):
    bees = Bees(temp_hive, backend=Mock())
    assert len(bees.children) == 0
    assert bees.get_by_id("non-existent") is None


def test_query_by_tags(temp_hive):
    bees = Bees(temp_hive, backend=Mock())
    store = bees._store

    # Create tasks with tags
    t1 = store.create("Task 1", tags=["bug", "ui"])
    t2 = store.create("Task 2", tags=["ui"])
    t3 = store.create("Task 3", tags=["bug"])
    
    # Create a child task with tags
    t4 = store.create("Task 4", tags=["bug", "ui"], creator_ticket_id=t2.id)

    # Test global query
    ui_tasks = bees.query(["ui"])
    assert len(ui_tasks) == 3  # t1, t2, t4
    ui_ids = {t.id for t in ui_tasks}
    assert ui_ids == {t1.id, t2.id, t4.id}

    bug_ui_tasks = bees.query(["bug", "ui"])
    assert len(bug_ui_tasks) == 2  # t1, t4
    bug_ui_ids = {t.id for t in bug_ui_tasks}
    assert bug_ui_ids == {t1.id, t4.id}

    # Test subtree query
    t2_node = bees.get_by_id(t2.id)
    assert t2_node is not None
    
    subtree_bug_tasks = t2_node.query(["bug"])
    assert len(subtree_bug_tasks) == 1  # t4
    assert subtree_bug_tasks[0].id == t4.id


@pytest.mark.asyncio
async def test_bees_create_child(temp_hive):
    bees = Bees(temp_hive, backend=Mock())
    bees._scheduler = Mock()
    
    mock_ticket = Mock()
    mock_ticket.id = "task1"
    mock_ticket.metadata = Mock()
    mock_ticket.metadata.tags = []
    bees._scheduler.create_task = AsyncMock(return_value=mock_ticket)
    
    node = await bees.create_child("New Task", tags=["test"])
    
    bees._scheduler.create_task.assert_called_once_with("New Task", tags=["test"])
    assert node.id == "task1"


@pytest.mark.asyncio
async def test_task_node_create_child(temp_hive):
    bees = Bees(temp_hive, backend=Mock())
    bees._scheduler = Mock()
    
    mock_ticket = Mock()
    mock_ticket.id = "child1"
    mock_ticket.metadata = Mock()
    mock_ticket.metadata.tags = []
    bees._scheduler.create_task = AsyncMock(return_value=mock_ticket)
    
    parent_ticket = Mock()
    parent_ticket.id = "parent1"
    parent_ticket.metadata = Mock()
    parent_ticket.metadata.tags = []
    
    parent_node = TaskNode(parent_ticket, bees)
    
    child_node = await parent_node.create_child("Child Task")
    
    bees._scheduler.create_task.assert_called_once_with("Child Task", owning_task_id="parent1", creator_ticket_id="parent1")
    assert child_node.id == "child1"


def test_task_node_respond(temp_hive):
    bees = Bees(temp_hive, backend=Mock())
    store_mock = Mock()
    bees._store = store_mock
    
    ticket = Mock()
    ticket.id = "task1"
    node = TaskNode(ticket, bees)
    
    node.respond({"text": "reply"})
    
    store_mock.respond.assert_called_once_with("task1", {"text": "reply"})


def test_bees_all(temp_hive):
    bees = Bees(temp_hive, backend=Mock())
    store_mock = Mock()
    bees._store = store_mock
    
    t1 = Mock()
    t1.id = "t1"
    t1.metadata = Mock()
    t1.metadata.tags = []
    
    t2 = Mock()
    t2.id = "t2"
    t2.metadata = Mock()
    t2.metadata.tags = []
    
    store_mock.query_all.return_value = [t1, t2]
    
    all_nodes = bees.all
    assert len(all_nodes) == 2
    assert all_nodes[0].id == "t1"
    assert all_nodes[1].id == "t2"
