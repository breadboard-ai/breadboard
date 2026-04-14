# Bees API Reference

The `bees` library is a framework for building agent swarm systems.

## Core Concepts

- **`Bees`**: The high-level entry point for the library
- **`TaskNode`**: Represents a task in the tree, providing traversal properties
  like `children` and `parent`.

## Classes

### `Bees`

The main entry point for interacting with a hive of tasks.

#### `__init__(self, hive_dir: Path)`

Initializes a new `Bees` instance.

- **`hive_dir`**: The root directory of the hive where tasks are stored.

#### `children`

Property that returns all root tasks (tasks that have no parents) in the hive.

- **Returns**: A list of `TaskNode` objects representing the root tasks.

#### `get_by_id(self, task_id: str) -> TaskNode | None`

Looks up a task by its unique ID.

- **`task_id`**: The UUID string of the task.
- **Returns**: A `TaskNode` if found, or `None` if the task does not exist.

#### `query(self, tags: list[str]) -> list[TaskNode]`

Searches for tasks in the hive that contain all of the specified tags.

- **`tags`**: A list of tags to search for.
- **Returns**: A list of `TaskNode` objects matching all tags.

### `TaskNode`

A wrapper around a task that provides DOM-like traversal properties.

#### Properties

- **`id`**: `str` (Read-only) The unique identifier of the task.

- **`task`**: `Ticket` (Read-only) The underlying ticket object containing task details.

- **`children`**: `list[TaskNode]` (Read-only) A list of child tasks that have
  this task as their parent.

- **`parent`**: `TaskNode | None` (Read-only) The parent task of this task, or
  `None` if it is a root task.

#### `query(self, tags: list[str]) -> list[TaskNode]`

Searches for tasks in the subtree that contain all of the specified tags.

- **`tags`**: A list of tags to search for.
- **Returns**: A list of `TaskNode` objects matching all tags.
