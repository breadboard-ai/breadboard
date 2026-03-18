# Agent Loop Architecture

`loop.py` is a **pure Gemini function-calling orchestrator**. It knows nothing
about sessions, HTTP, file systems, or progress UIs. Its only job is to drive
the model ↔ tool cycle until the agent decides it is done.

---

## Key Design Decisions

These properties shape every design decision in the loop.

**1. The model may only call functions — never produce text.**
`functionCallingConfig: {mode: "ANY"}` is set on every request. Every model turn
is a tool call. There is no "free text" path. This approach narrows the set of
possible actions to the set of functions available.

**2. Normal termination is an explicit agent decision.** The loop runs until the
agent calls `system_objective_fulfilled` (success) or
`system_failed_to_fulfill_objective` (failure). The loop cannot "fall through"
to a done state — the agent must declare it. Abnormal termination (uncaught
exception, fatal errors from function handlers, no candidates in response)
bypasses this and returns an error outcome directly.

**3. Loop state is fully serializable plain data.** When the loop suspends, its
complete runtime state is captured in `InteractionState`: the conversation
history (`contents`), a snapshot of the agent file system, a snapshot of the
task tree, the active feature flags, granted consents, and the graph identity.
All of these are plain dicts and scalars — no live objects, no closures. This is
what makes suspend/resume possible: the entire loop can be frozen to a JSON blob
and reconstructed from it on the next request.

**4. Observability is injected; the loop reports but does not store.** The loop
produces events (thoughts, function calls, results) but has no knowledge of how
they are delivered. Progress UIs, SSE streams, and run-state trackers are wired
in via `LoopHooks` callbacks. The loop fires hooks but takes no action itself.

**5. Binary data never enters the loop — only handles do.** Images, files, and
other binary objects are registered in the `AgentFileSystem` before the loop
starts and represented in the conversation as lightweight handles via pidgin
(see `PIDGIN.md`). The handle travels through `contents` unchanged — it is
resolved to a Gemini-consumable URL only at request time. This keeps the
conversation history unconditionally serializable and the model context free of
raw data blobs.

---

## The Core Loop at a Glance

```
objective
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                     Loop.run()                          │
│                                                         │
│  contents = [objective]                                 │
│                                                         │
│  while not terminated:                                  │
│    ┌──────────────────────────────────────────────┐     │
│    │  Build GeminiBody (tools + system instr.)    │     │
│    │  →  conform_body (resolve storedData refs)   │     │
│    │  →  stream_generate_content                  │     │
│    │       ├─ thought parts  →  on_thought()      │     │
│    │       └─ functionCall parts                  │     │
│    │             └─ FunctionCaller.call()         │     │
│    │                  (queued as asyncio.Task)    │     │
│    │                                              │     │
│    │  await FunctionCaller.get_results()          │     │
│    │       ├─ SuspendError  →  SuspendResult      │     │
│    │       └─ FunctionCallResult[]                │     │
│    │             └─ append combined to contents   │     │
│    └──────────────────────────────────────────────┘     │
│                                                         │
│  return controller.result   (set by a tool handler)     │
└─────────────────────────────────────────────────────────┘
```

---

## What Goes Into Each Request

Every Gemini request is constructed fresh inside the `while` loop from three
sources:

### 1. `contents` — the conversation history

`contents` starts as `[objective]` — a single `LLMContent` containing the user's
request. After each model turn the loop appends two things:

1. The model's response content (including thought and function-call parts).
2. A combined `LLMContent` of all function responses (role `"user"`).

This growing list is the full context sent to the model on the next turn. The
model therefore always sees the complete conversation: objective → model turn →
function results → model turn → …

### 2. `tools` — the function declarations

All `FunctionGroup` objects provided by the caller are merged into a single
`[{"functionDeclarations": [...]}]` list. This is what tells the model which
functions it may call. The declarations are **schema-only** — they contain no
implementation.

### 3. `systemInstruction` — behavioral instructions

Each `FunctionGroup` may carry an `instruction` string. These are concatenated
with double newlines and sent as the `systemInstruction` field. Different agent
types compose different groups, so the system prompt is dynamically assembled
from the active toolset.

---

## Generation Config: Why These Settings

```python
"generationConfig": {
    "temperature": 1,
    "topP": 1,
    "thinkingConfig": {
        "includeThoughts": True,
        "thinkingBudget": -1,
    },
},
"toolConfig": {
    "functionCallingConfig": {"mode": "ANY"},
},
```

- **`temperature: 1, topP: 1`** — MaxEntropy sampling. The agent is expected to
  make deliberate tool calls, not write prose; diversity penalties would only
  hurt.
- **`includeThoughts: True`** — Requests reasoning traces in the response
  stream. These arrive as parts with `"thought": true` alongside regular parts.
- **`thinkingBudget: -1`** — Unlimited thinking; the model decides how much
  reasoning to do per turn.
- **`functionCallingConfig mode: "ANY"`** — Forces the model to always call a
  function. It cannot respond with pure text. This is what stops the loop from
  drifting into conversational output — every turn must be an action.

---

## Ingress and Egress: The Pidgin Boundary

The loop operates entirely in pidgin — the lightweight markup language described
in [PIDGIN.md](PIDGIN.md). Structured data enters the loop as pidgin text and
leaves the loop by being resolved back from pidgin into structured parts. This
boundary is enforced at two points:

**Ingress (structured → pidgin).** Before the loop starts, `to_pidgin` converts
the client's typed segments (assets, inputs, tools) into pidgin text and
registers any binary parts in the `AgentFileSystem`. The resulting text becomes
the objective. When a function handler produces structured content that needs to
re-enter the conversation (e.g., a sub-generation result), it uses
`content_to_pidgin_string` to convert it back into pidgin before returning it to
the loop.

**Egress (pidgin → structured).** When function handlers receive pidgin text
from the model (e.g., an objective-fulfilled outcome, a chat message, a generate
prompt), they call `from_pidgin_string` to resolve `<file>` handles back into
binary `LLMContent` parts via the `AgentFileSystem`. This is where the handles
placed by ingress are dereferenced.

Between these two boundaries, `conform_body` resolves `storedData` and
`fileData` references to Gemini File API URLs immediately before each API call.
This ensures the model always receives resolvable URLs rather than
application-internal handles.

---

## Processing the Stream

The response from `stream_generate_content` is an async iterator of
`GeminiChunk` dicts. The loop processes each chunk's `candidates[0].content`
immediately as it arrives:

```
chunk
 └─ candidates[0].content
      └─ parts[]
           ├─ {thought: true, text: "..."}  →  on_thought(text)
           └─ {functionCall: {name, args}}  →  FunctionCaller.call(...)
```

The content object is also appended to `contents` immediately. This is
intentional: it means the model's full turn (thoughts + function calls) is part
of the history before function results come back.

---

## Concurrent Function Execution

When the model calls multiple functions in a single turn, the loop queues each
one as a separate `asyncio.Task` via `FunctionCaller.call()`. They execute
**concurrently**, matching the TypeScript `Promise.all` behavior.

`FunctionCaller.get_results()` awaits all tasks together and produces:

```python
{
    "combined": {"role": "user", "parts": [<functionResponse>, ...]},
    "results": [FunctionCallResult, ...]
}
```

The `combined` content is what gets appended to `contents` and sent back to the
model. The `results` list is used to fire `on_function_result` hooks per call.

### Error handling within function calls

- **Unknown function**: returns a `functionResponse` with `{"error": "..."}`.
  The model sees this as a recoverable tool failure and may retry or adjust.
- **Handler exception**: same — wrapped in a `functionResponse` error, not a
  loop abort.
- **Fatal `$error` outcome**: if a handler returns `{"$error": "..."}` (not
  raises), `get_results` propagates it immediately and `Loop.run()` returns it
  as the overall result, aborting the loop.
- **`SuspendError`**: see below.

---

## Hooks: Observing Without Coupling

`LoopHooks` is a dataclass of optional callbacks. The loop fires them at key
points but does not depend on them — every field is `None` by default. This is
how different agent types plug in progress reporting, run-state tracking, and
debugging without the loop knowing about any of those concerns:

| Hook                      | When it fires                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `on_start`                | Before the first Gemini request (not on resume)                                      |
| `on_finish`               | After the loop exits (not on suspend)                                                |
| `on_thought`              | For each thought part in the stream                                                  |
| `on_function_call`        | When a function call part is encountered; returns a `callId` and optional `reporter` |
| `on_function_call_update` | When a function handler posts a status update                                        |
| `on_function_result`      | After each function completes                                                        |
| `on_turn_complete`        | After all function results for a turn are appended                                   |
| `on_send_request`         | Before each Gemini request (useful for debugging)                                    |

The distinction between `on_finish` and `on_turn_complete` matters: `on_finish`
fires once when the entire run ends; `on_turn_complete` fires after every
model–tool cycle within a run.

---
