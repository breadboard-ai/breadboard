> [!NOTE]
> This concept shipped as **Project Acoustic**
> ([PROJECT_ACOUSTIC.md](../../PROJECT_ACOUSTIC.md)). The architecture diverged
> from what's described here: the filesystem interchange pattern replaced the
> REST APIs (`/session-bundle`, `/tool-dispatch`, `/session-status`), and
> `session_type: delegated` became `runner: live`. The doc remains as a record
> of the original design exploration.

# Delegated Sessions

A delegated session is a session whose execution is owned by an external party
— typically the browser — rather than by the scheduler. The scheduler provisions
the session (tools, system instruction, auth) and provides a tool dispatch
service, but the model connection itself lives elsewhere.

The motivating use case is the Gemini Live API: real-time, bidirectional audio
conversations that require a persistent WebSocket between the browser and
Gemini. The scheduler can't own that connection — it's a batch orchestrator, not
a streaming audio relay. But it still needs to provision the agent's tools and
track the session in the agent tree.

## Why not just a new session type?

The existing session layer (`session.py` → `Loop`) is a synchronous
request-response loop: accumulate context, call GenerateContent, dispatch
function calls, repeat. The Live API is fundamentally different — full-duplex
WebSocket, continuous audio streams, server-managed context, barge-in.

Trying to make the existing `Loop` bidirectional would fight the grain of both
APIs. Instead, delegated sessions acknowledge that the *transport* is someone
else's problem while keeping the *tooling and lifecycle* inside bees.

## The split

A delegated session separates two concerns that the current session layer
bundles together:

| Concern              | Current session              | Delegated session            |
| -------------------- | ---------------------------- | ---------------------------- |
| Model connection     | Bees (via `Loop`)            | Browser (via Live API WS)    |
| Tool provisioning    | Bees (FunctionGroup assembly)| Bees (same)                  |
| Tool execution       | Bees (FunctionCaller)        | Bees (via dispatch endpoint) |
| System instruction   | Bees (segment assembly)      | Bees (same, in bundle)       |
| Audio I/O            | N/A                          | Browser (MediaStream API)    |
| Session lifecycle    | Scheduler (run/resume)       | Scheduler (provision/observe)|
| Agent tree visibility| Yes                          | Yes                          |

The browser gains ownership of the model connection and audio path. Everything
else stays in bees.

## How it works

### 1. Template declaration

A template opts into delegated execution via `session_type`:

```yaml
- name: opie-live
  title: Opie (Live)
  session_type: delegated
  objective: >
    You are Opie, an executive assistant. Use the "persona" skill to learn
    how to behave. You are in a live audio conversation with the user.
  skills:
    - persona
  functions:
    - files.*
    - tasks.*
```

The `functions` and `skills` fields work identically to batch sessions. The
template author controls what tools the agent has access to.

### 2. Session provisioning

When the scheduler encounters a delegated task, it does not call `run_session`.
Instead, it assembles a **session bundle** — everything an external client needs
to start a session:

- **System instruction** — assembled from the objective, skill instructions, and
  function group instructions, exactly as `run_session` does today.
- **Tool declarations** — the JSON schemas from each enabled FunctionGroup,
  filtered by the template's `functions` list.
- **Server tool names** — which tools require server-side dispatch (vs. tools
  the client could hypothetically handle locally).
- **Auth token** — an ephemeral token for direct Gemini API access.
- **Model** — the Live API model identifier.
- **Session config** — response modalities, voice settings, etc.

The bundle is exposed via the reference app's REST API:

```
GET /agents/{agent_id}/session-bundle → SessionBundle
```

### 3. Browser session lifecycle

The browser receives the bundle and:

1. Opens a WebSocket to the Gemini Live API using the ephemeral token.
2. Configures the session with the system instruction, tool declarations, and
   response modalities from the bundle.
3. Starts audio capture and playback.
4. Enters an event loop: receives model responses (audio, text, tool calls) and
   sends user input (audio, text).

When the model makes a tool call, the browser dispatches it to the bees server.

### 4. Tool dispatch

The reference app exposes a tool dispatch endpoint:

```
POST /agents/{agent_id}/tool-dispatch
```

```json
{
  "calls": [
    { "id": "call_123", "name": "tasks_create_task", "args": { ... } }
  ]
}
```

The server:

1. Looks up the provisioned session for this agent.
2. Validates that each tool name is in the session's allowed function set.
3. Dispatches each call through the corresponding FunctionGroup handler — the
   same handler that `FunctionCaller` would use in a batch session.
4. Returns the results.

```json
{
  "responses": [
    { "id": "call_123", "name": "tasks_create_task", "response": { ... } }
  ]
}
```

The browser sends these back to the Live API as `FunctionResponse`s.

### 5. Scheduler observation

The scheduler tracks delegated sessions through status transitions:

```
available → provisioned → live → completed / failed
```

- **provisioned** — bundle assembled, waiting for browser to connect.
- **live** — browser has an active session. The scheduler skips this task in
  batch cycles but keeps it visible in the agent tree.
- **completed / failed** — browser reports session end.

The browser reports lifecycle events via REST:

```
POST /agents/{agent_id}/session-status
{ "status": "live" | "completed" | "failed", "summary": "..." }
```

## Async tool calling and task delegation

The Live API supports `NON_BLOCKING` function declarations. A tool marked
non-blocking runs asynchronously — the model continues the conversation while
the tool executes. When the result arrives, it can interrupt the conversation
(`INTERRUPT`), wait for a pause (`WHEN_IDLE`), or be absorbed silently
(`SILENT`).

This maps naturally to task delegation. When the Live agent calls
`tasks_create_task`, the server creates a batch subagent. The tool is declared
`NON_BLOCKING` so the agent keeps talking to the user. When the batch subagent
completes, the server returns the tool response with `scheduling: "INTERRUPT"`,
and the agent incorporates the result conversationally.

```
User:   "Can you research market trends for Q3?"
Agent:  "Sure, let me set that up."
        → tasks_create_task (NON_BLOCKING)
        ← server creates batch research subagent
Agent:  "I've started a research task. What else can I help with?"
User:   "What's on my calendar today?"
Agent:  "Let me check..." (continues conversation)
        ← research task completes
        ← FunctionResponse arrives with scheduling=INTERRUPT
Agent:  "By the way, the research is done. Here's what I found..."
```

This is the opie pattern — delegate work, stay available — made native by the
Live API's async function calling.

## What the browser needs

The browser's responsibilities in a delegated session:

1. **WebSocket management** — connect to Gemini Live API, handle reconnection
   on transient errors.
2. **Audio I/O** — capture microphone input (16kHz PCM), play model audio output
   (24kHz PCM). Uses MediaStream API and AudioContext.
3. **Tool dispatch relay** — when the model calls a tool, POST to the bees
   server's dispatch endpoint, send the response back to the Live API.
4. **Lifecycle reporting** — inform the server when the session starts, ends, or
   encounters an error.
5. **Transcription display** — the Live API provides input and output
   transcriptions alongside audio. The UI renders these as a conversation log.

The browser does NOT:

- Assemble system instructions (bees does this).
- Decide which tools are available (the template controls this).
- Execute tools locally (all dispatch goes to the server, at least initially).

## Relationship to the existing session layer

Delegated sessions reuse the session layer's infrastructure without using its
execution path:

| Component               | Reused? | How                                                   |
| ----------------------- | ------- | ----------------------------------------------------- |
| FunctionGroup assembly  | Yes     | Same factory, same filter, same declarations          |
| System instruction      | Yes     | Same segment resolution, same skill merging           |
| FunctionGroup handlers  | Yes     | Same handlers, invoked via dispatch endpoint          |
| DiskFileSystem          | Yes     | Same working directory, same VFS layer                |
| SubagentScope           | Yes     | Same permission model for tool dispatch               |
| EvalCollector           | Partial | Tool dispatch events logged; audio content is not     |
| Loop / FunctionCaller   | No      | Replaced by browser + Live API                        |
| Suspend / resume        | No      | Live sessions don't suspend — they're always-on       |
| InteractionStore        | No      | No state serialization needed — session is transient  |

## Open questions

**Session duration.** Live API sessions have a maximum duration. When a session
expires, the browser needs to re-provision (request a new bundle) and reconnect.
The Live API supports session resumption — whether this is transparent to the
user or requires a brief interruption is an open design question.

**Subagent results.** When a batch subagent completes and its result needs to
flow back into the Live session, the server holds the `FunctionResponse` until
the browser polls for it or pushes it via an SSE sidecar. The exact delivery
mechanism needs design.

**Observability.** Batch sessions produce detailed eval logs (per-turn context
size, token usage, function calls). Delegated sessions are partially opaque —
the model interaction happens in the browser. Tool dispatch calls are logged
server-side, but the conversation content is not. Whether this needs to change
depends on audit requirements.

**Client-side tool execution.** Some tools could run in the browser (e.g., a
"display this to the user" tool). The initial design routes everything through
the server. Moving tools client-side is an optimization that trades server
round-trips for client complexity.
