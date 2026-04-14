# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import tempfile
from pathlib import Path
import pytest
from bees import Bees


@pytest.fixture
def temp_hive():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def test_tree_traversal(temp_hive):
    bees = Bees(temp_hive)
    store = bees.store

    # Create a tree structure
    # root1
    #   ├── child1
    #   │     └── grandchild1
    #   └── child2
    # root2

    root1 = store.create("Root 1")
    root2 = store.create("Root 2")

    child1 = store.create("Child 1", parent_ticket_id=root1.id)
    child2 = store.create("Child 2", parent_ticket_id=root1.id)

    grandchild1 = store.create("Grandchild 1", parent_ticket_id=child1.id)

    # Test get_children
    roots = bees.get_children()
    assert len(roots) == 2
    root_ids = {r.id for r in roots}
    assert root_ids == {root1.id, root2.id}

    # Test children traversal
    root1_node = bees.get_node(root1.id)
    assert root1_node is not None
    children = root1_node.children
    assert len(children) == 2
    child_ids = {c.id for c in children}
    assert child_ids == {child1.id, child2.id}

    # Test parent traversal
    child1_node = bees.get_node(child1.id)
    assert child1_node is not None
    assert child1_node.parent is not None
    assert child1_node.parent.id == root1.id

    # Test deep traversal
    grandchild1_node = bees.get_node(grandchild1.id)
    assert grandchild1_node is not None
    assert grandchild1_node.parent is not None
    assert grandchild1_node.parent.id == child1.id
    assert grandchild1_node.parent.parent is not None
    assert grandchild1_node.parent.parent.id == root1.id

    # Test edge cases
    root2_node = bees.get_node(root2.id)
    assert root2_node is not None
    assert len(root2_node.children) == 0
    assert root2_node.parent is None


def test_empty_store(temp_hive):
    bees = Bees(temp_hive)
    assert len(bees.get_children()) == 0
    assert bees.get_node("non-existent") is None
