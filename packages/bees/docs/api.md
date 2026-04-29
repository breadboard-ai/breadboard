# Bees API Reference

The `bees` library is a framework for building agent swarm systems.

## Core Concepts

- **`Bees`**: The high-level entry point for the library, analogous to `document` in the DOM.
- **`TaskNode`**: Represents a task in the tree, analogous to an `Element` in the DOM.

## Classes

### `Bees`

The main entry point for interacting with a hive of tasks.

#### `__init__(self, hive_dir: Path, runners: dict[str, SessionRunner])`

Initializes a new `Bees` instance.

- **`hive_dir`**: The root directory of the hive where tasks are stored.
- **`runners`**: A dictionary mapping runner types to `SessionRunner` implementations (e.g., `{"generate": GeminiRunner(...), "live": LiveRunner(...)}`).

#### `children`

Property that returns all root tasks (tasks that have no parents) in the hive.

- **Returns**: A list of `TaskNode` objects representing the root tasks.

#### `all`

Property that returns all tasks in the hive.

- **Returns**: A list of `TaskNode` objects representing all tasks.

#### `get_by_id(self, task_id: str) -> TaskNode | None`

Looks up a task by its unique ID.

- **`task_id`**: The UUID string of the task.
- **Returns**: A `TaskNode` if found, or `None` if the task does not exist.

#### `query(self, tags: list[str]) -> list[TaskNode]`

Searches for tasks in the hive that contain all of the specified tags.

- **`tags`**: A list of tags to search for.
- **Returns**: A list of `TaskNode` objects matching all tags.

#### `create_child(self, objective: str, **kwargs) -> TaskNode` (Async)

Creates a new root task in the hive.

- **`objective`**: The description of the task.
- **`**kwargs`**: Additional arguments for task creation (e.g., `tags`).
- **Returns**: A `TaskNode` representing the newly created task.

#### `on(self, event_type: type[T], callback: Callable[[T], Any])`

Registers a typed event listener.

- **`event_type`**: The event class to listen for. Available types: `TaskAdded`, `CycleStarted`, `TaskEvent`, `TaskStarted`, `TaskDone`, `BroadcastReceived`, `CycleComplete`.
- **`callback`**: The callback function, receiving the typed event instance.

Example:
```python
bees.on(TaskDone, lambda e: print(f"Done: {e.task.id}"))
```

#### `listen(self)` (Async)

Starts the scheduler loop and begins processing tasks.

#### `shutdown(self)` (Async)

Stops the scheduler loop and cleans up resources.

#### `pause_all(self) -> int`

Pauses all non-terminal tasks. Cancels in-flight asyncio tasks and sets
status to `paused`, preserving the original status in `paused_from`.

- **Returns**: The number of tasks paused.

#### `resume_all(self) -> int`

Resumes all paused tasks, restoring their pre-pause status from `paused_from`.

- **Returns**: The number of tasks resumed.

### `TaskNode`

A wrapper around a task that provides DOM-like traversal properties and manipulation methods.

#### Properties

- **`id`**: `str` (Read-only) The unique identifier of the task.

- **`task`**: `Ticket` (Read-only) The underlying ticket object containing task details.

- **`children`**: `list[TaskNode]` (Read-only) A list of child tasks that have this task as their parent.

- **`parent`**: `TaskNode | None` (Read-only) The parent task of this task, or `None` if it is a root task.

- **`awaiting_response`**: `bool` (Read-only) Returns `True` if the task is suspended and assigned to the user, indicating it is waiting for a response.

#### Methods

#### `query(self, tags: list[str]) -> list[TaskNode]`

Searches for tasks in the subtree that contain all of the specified tags.

- **`tags`**: A list of tags to search for.
- **Returns**: A list of `TaskNode` objects matching all tags.

#### `create_child(self, objective: str, **kwargs) -> TaskNode` (Async)

Creates a child task under this task.

- **`objective`**: The description of the task.
- **`**kwargs`**: Additional arguments for task creation.
- **Returns**: A `TaskNode` representing the newly created child task.

#### `respond(self, response: dict | None = None, *, text: str | None = None, selectedIds: list[str] | None = None)`

Submits a response to the task (e.g., answering a question or providing data). Supports both dictionary style and specific keyword arguments for improved ergonomics.

- **`response`**: A dictionary containing the response data (e.g., `{"text": "..."}`).
- **`text`**: (Keyword only) The text response to provide.
- **`selectedIds`**: (Keyword only) A list of selected choice IDs.

> [!NOTE]
> You must provide either `text` or `selectedIds` when using keyword arguments, or pass a dictionary as the `response` argument. You cannot provide both keyword arguments, nor can you mix a dictionary response with keyword arguments.

#### `save(self)`

Saves the task's current state to persistent storage.

#### `retry(self)`

Retries a paused task by resetting its status to available and clearing errors.

#### `pause(self) -> bool`

Pauses this task. Cancels the asyncio task if running, stashes the current
status in `paused_from`, and sets status to `paused`.

- **Returns**: `True` if the task was paused, `False` if already terminal or paused.

#### `resume(self) -> bool`

Resumes this task from a paused state, restoring the pre-pause status.

- **Returns**: `True` if the task was resumed, `False` if it wasn't paused.
