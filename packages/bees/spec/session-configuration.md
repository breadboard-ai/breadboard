# Session Configuration — Spec Doc

**Goal**: Extract the provisioning logic from `session.py` — the code that
assembles everything a session needs from a task — into a named concept
(`SessionConfiguration`) and a standalone function, so that `session.py`
becomes purely session execution and the `SessionRunner` protocol has a
well-defined input type.

## Context

`run_session()` and `resume_session()` in `session.py` (~400 lines each)
conflate two concerns:

1. **Provisioning** — assembling function groups, setting up the file system,
   filtering skills, resolving segments. Pure bees framework logic with zero
   opal deps.
2. **Execution** — calling `opal_backend`'s session API (`new_session`,
   `start_session`), draining the event queue. This is the runner.

The provisioning logic stays in bees permanently. The execution logic moves to
`bees-gemini`. This spec extracts concern #1 into a named type and function,
creating the clean cut line for the `SessionRunner` protocol.

### What provisioning does today

Tracing `run_session()`, the provisioning steps are:

1. Resolve `hive_dir` from `ticket_dir` or config.
2. Filter skills and merge function filter (`filter_skills`,
   `merge_function_filter`).
3. Create `DiskFileSystem` backed by `fs_dir` or `ticket_dir/filesystem`.
4. Seed skill files into the file system.
5. Assemble function group factories (system, simple_files, skills, sandbox,
   events, tasks, chat) plus MCP factories.
6. Resolve the model name and log path.

Steps 1–6 produce everything the execution step needs. The output is a
`SessionConfiguration`.

## Design Decisions

### `SessionConfiguration` is a dataclass, not a Protocol

It's a value type — a bundle of assembled ingredients. There's no abstraction
boundary here; there's one way to provision a session. Contrast with
`SessionRunner`, which has multiple implementations (batch, live, test).

### Function groups are `FunctionGroupFactory` instances

The runner receives factories, not assembled groups. Assembly happens inside
the runner because `opal_backend`'s `new_session` expects factories. This
matches the current call signature and avoids premature assembly.

### The provisioning function takes a `Ticket`, not raw parameters

Today `run_session` takes ~15 keyword arguments threaded from `task_runner.py`.
Most of these are derived from the ticket. The provisioning function should
take the `Ticket` (plus a few infrastructure dependencies) and produce the
configuration. This eliminates the parameter-threading.

### Event observation stays outside the runner

The `EvalCollector` and `_print_event_summary` — event observation logic — are
bees framework concerns. They consume the event stream that the runner
produces. In the async iterator model, bees drives the event loop:

```python
async for event in stream:
    collector.collect(event)
    if event is a tool_call:
        result = await dispatch(event)
        await stream.send_tool_response(result)
```

This keeps observation in bees where it belongs, and makes `EvalCollector`
reusable across any runner.

### `SessionStream` is the runner's return type

The runner returns a `SessionStream` — an async iterable of events with
back-channel methods for tool responses and context injection. This
accommodates both batch and Live runners:

- **Batch runner**: yields observation events (thought, functionCall,
  usageMetadata, complete). Tool dispatch is internal; `send_tool_response` is
  never called. `send_context` pushes to the context queue.
- **Live runner**: yields both observation events AND `tool_call` request
  events. Bees dispatches tools and calls `send_tool_response`. `send_context`
  calls `session.send_client_content` on the WebSocket.

The transition from internal to external tool dispatch (delegated tools) is
additive: the batch runner starts yielding `tool_call` events and bees adds a
handler. No protocol break.

### `SessionResult` is constructed by bees, not the runner

The runner yields events. Bees uses `EvalCollector` to accumulate them into a
`SessionResult`. This way `SessionResult` is a bees-native concept and the
runner doesn't need to know about it.

> **Open question**: Should the runner signal completion with a final event
> (e.g. `{"complete": {...}}`), or should it just stop yielding? The current
> batch model uses a sentinel `None` on the queue. For the async iterator
> model, `StopAsyncIteration` (normal iterator exhaustion) is the natural
> signal. The runner raises it when the session ends; bees sees the `async for`
> loop exit and constructs `SessionResult` from the collector.

### Resume is a separate runner method, not a separate provisioning path

Resume needs the same `SessionConfiguration` (function groups, file system,
skills — unchanged between runs) plus two additional inputs:

1. **Resume state** — the opaque blob from `stream.resume_state()`, persisted
   by bees between runs. The runner deserializes its own state.
2. **User response** — the `response.json` content (text, context updates).

The runner has two entry points:

```python
class SessionRunner(Protocol):
    def run(self, config: SessionConfiguration) -> SessionStream: ...
    def resume(
        self, config: SessionConfiguration,
        state: bytes, response: dict[str, Any],
    ) -> SessionStream: ...
```

Both return a `SessionStream` (one run). The provisioning function produces
the same `SessionConfiguration` for both — the only difference is which
runner method is called.

This means `task_runner.py` no longer imports `InteractionState` or calls
`_save_session_state` with opal internals. It stores/retrieves an opaque blob.
The batch runner (`bees-gemini`) internalizes opal serialization; a future
Live runner internalizes token-based resumption.

**The full `SessionRunner` protocol is deferred to its own spec**, which
builds on the types defined here.

## Protocol Inventory

| Type / Function             | Status    | Category     |
| --------------------------- | --------- | ------------ |
| `SessionConfiguration`      | ✅ Spec'd + Tested | Specify      |
| `SessionStream`             | ✅ Spec'd + Tested | Specify      |
| `SessionEvent`              | ✅ Spec'd + Tested | Specify      |
| `provision_session`          | ✅ Implemented    | Migrate      |

## Protocol Shapes

### `SessionConfiguration`

```python
@dataclass
class SessionConfiguration:
    """Everything a session runner needs to start a session.

    Assembled by the provisioning function from a task's metadata,
    skills, and function declarations. The runner brings its own
    auth — no credentials appear here.
    """

    segments: list[dict[str, Any]]
    """Input segments for the session (text, structured data)."""

    function_groups: list[FunctionGroupFactory]
    """Assembled function group factories for tool declarations."""

    function_filter: list[str] | None
    """Optional allowlist of function names."""

    model: str | None
    """Model identifier (e.g. 'gemini-2.5-flash')."""

    file_system: FileSystem
    """Disk-backed file system for the session's workspace."""

    label: str
    """Short label for log prefixes (usually ticket_id[:8])."""

    log_path: Path
    """Path for the eval log output."""

    on_chat_entry: Callable[[str, str], None] | None
    """Optional callback for chat log entries."""
```

> **Future concern: Observation.** `label`, `log_path`, and `on_chat_entry`
> feel like observation concerns rather than runner inputs. A future spec may
> extract an `ObservationConfig` that bees wires into its event-draining loop
> separately from the runner's configuration. For now they stay here because
> provisioning currently assembles them.

### `SessionStream`

A `SessionStream` represents **one run** — a sequence of turns that starts
fresh or resumes and ends when the model terminates, suspends, or pauses.
Using the terminology from [architecture.md](../docs/architecture.md):

- A **turn** is a single LLM call with response.
- A **run** is a sequence of turns. Ends on termination, suspension, or pause.
- A **session** spans multiple runs (initial run → suspend → resume → ...).

The `SessionStream` boundary is the run. The cross-run lifecycle (detecting
suspension, persisting state, waiting for user input, triggering resume) stays
in `TaskRunner` and `Scheduler` — exactly where it is today.

```python
class SessionStream(Protocol):
    """A running session's event stream — one run.

    The async iterator yields session events until the run ends
    (StopAsyncIteration). Events include observations (thought,
    functionCall, usageMetadata, complete, error, suspend, pause)
    and — for runners with external tool dispatch — tool_call requests.

    Back-channel methods allow the framework to respond to tool calls
    and inject context updates mid-run.
    """

    def __aiter__(self) -> AsyncIterator[SessionEvent]: ...
    async def __anext__(self) -> SessionEvent: ...

    async def send_tool_response(
        self, responses: list[dict[str, Any]],
    ) -> None:
        """Send tool execution results back to the model.

        Called when the event stream yields a tool_call event. The
        runner blocks on __anext__ until this is called.
        """
        ...

    async def send_context(
        self, parts: list[dict[str, Any]],
    ) -> None:
        """Inject context parts into the running session.

        Used for mid-session context updates (e.g. child task
        completion notifications).
        """
        ...

    def resume_state(self) -> bytes | None:
        """Opaque blob the runner needs to resume this session.

        Returns None if the run completed (no resume needed).
        Available after the stream exhausts (StopAsyncIteration).

        The resume state is runner-internal. Bees persists it as an
        opaque blob and hands it back on resume. For the batch runner
        this is serialized opal_backend InteractionState. For the
        Live runner this would be a session resumption token.
        """
        ...
```

### `SessionEvent`

```python
SessionEvent = dict[str, Any]
```

A session event is a dict with a single key naming the event type. This
mirrors the current event format used by `EvalCollector` and throughout the
codebase. Event types include:

- `sendRequest` — turn boundary (new model request)
- `thought` — model thinking
- `functionCall` — model called a function (observation)
- `usageMetadata` — token usage for the turn
- `complete` — session completed
- `error` — session error
- `paused` — transient infrastructure pause
- `waitForInput`, `waitForChoice`, etc. — suspend events (from SUSPEND_TYPES)
- `tool_call` — (future) model requests tool dispatch

### `provision_session`

```python
async def provision_session(
    task: Ticket,
    *,
    store: TaskStore,
    hive_dir: Path,
    scope: SubagentScope | None = None,
    scheduler: Any | None = None,
    on_events_broadcast: Callable | None = None,
    deliver_to_parent: Callable | None = None,
    mcp_factories: list | None = None,
) -> SessionConfiguration:
    """Assemble everything a session runner needs from a task.

    Resolves segments, filters skills, creates the file system,
    assembles function group factories, and packages the result
    as a SessionConfiguration.
    """
    ...
```

## Migration Notes

### Target files

- `bees/protocols/session.py` — add `SessionConfiguration`,
  `SessionStream`, `SessionEvent` type alias.
- `bees/provisioner.py` — new module, `provision_session` function
  extracted from `run_session()`'s provisioning steps.

### What this enables

After this spec, `task_runner.py` can be restructured from:

```python
result = await run_session(
    segments=segments,
    backend=self._backend,
    label=label,
    ticket_id=task.id,
    ticket_dir=task.dir,
    fs_dir=task.fs_dir,
    on_event=self._make_on_event(task.id),
    function_filter=task.metadata.functions,
    allowed_skills=task.metadata.skills,
    model=task.metadata.model,
    ...13 more kwargs...
)
```

to:

```python
config = await provision_session(task, store=self._store, hive_dir=...)
stream = runner.run(config)
result = await drain_events(stream, collector, on_event=...)
```

The 15-parameter call becomes three clean steps: provision, run, observe.

### Conformance testing strategy

1. **`SessionConfiguration` structural check**: verify the dataclass has the
   expected fields and that a provisioned config from a test ticket populates
   them correctly.
2. **`provision_session` equivalence**: provision a test ticket and verify the
   resulting config matches what `run_session` would have assembled (same
   function groups, same file system, same segments).
3. **`SessionStream` protocol satisfaction**: verify a minimal mock
   (`__aiter__`, `__anext__`, `send_tool_response`, `send_context`) satisfies
   the protocol via `isinstance`.

### Dependencies

- `SessionResult` (already in `bees/protocols/session.py` — ✅)
- `FunctionGroupFactory` (already in `bees/protocols/functions.py` — ✅)
- `FileSystem` (already in `bees/protocols/filesystem.py` — ✅)
- `Ticket`, `TaskStore` (bees-native — ✅)
- `SubagentScope` (bees-native — ✅)

All dependencies are already extracted. This spec is a leaf.

### Relationship to `SessionRunner`

This spec defines the runner's **input** (`SessionConfiguration`) and
**output shape** (`SessionStream`). The `SessionRunner` protocol itself — the
`run(config) -> SessionStream` contract — is a follow-up spec that builds on
these types. It also addresses resume configuration and how the runner is
injected into `Scheduler` / `TaskRunner`.

```
SessionConfiguration ──→ SessionRunner ──→ SessionStream
       (this spec)       (next spec)       (this spec)
```
