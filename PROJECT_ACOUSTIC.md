# Project Acoustic — Gemini Live API Integration

Bees is a batch orchestrator: accumulate context, call GenerateContent, dispatch
tools, repeat. The Gemini Live API is fundamentally different — full-duplex
WebSocket, continuous audio streams, server-managed context. Rather than
fighting the grain of both APIs, Project Acoustic introduces a **delegated
session** pattern: bees provisions tools and auth, then delegates the model
connection to the browser while retaining orchestration, tool dispatch, and
lifecycle management.

## Architecture

```
┌──────────── Box (Python) ───────────┐    ┌────── Hivetool (Browser) ──────┐
│                                     │    │                                │
│  LiveRunner                         │    │  LiveSessionClient             │
│  ├─ extract tool declarations       │    │  ├─ read live_session.json     │
│  ├─ assemble system instruction     │    │  ├─ open WebSocket to Gemini   │
│  ├─ get ephemeral auth token        │    │  ├─ send setup message         │
│  ├─ write live_session.json ──────────────►  ├─ stream audio in/out       │
│  └─ LiveStream (polls for result)   │    │  ├─ relay tool calls ──────────┤
│                                     │    │  └─ write live_result.json     │
│  Tool Dispatch                      │    │                                │
│  ├─ watch tool_dispatch/*.json  ◄────────── write tool_dispatch/{id}.json │
│  ├─ execute Python handler          │    │                                │
│  └─ write {id}.result.json  ─────────────►  read result, relay to WS     │
└─────────────────────────────────────┘    └────────────────────────────────┘
```

Two processes, one filesystem. The box writes the session bundle; hivetool
runs the audio loop. Tool calls bounce through `tool_dispatch/` files. Live
events flow back through `live_events/` files, which `LiveStream` polls and
translates into `EvalCollector`-compatible events for `drain_session`.
The `live_result.json` file serves as a fallback termination signal.

## Communication Protocol

All communication between box and browser uses the task directory on the
shared filesystem:

| File                        | Writer   | Reader   | Purpose                                    |
| --------------------------- | -------- | -------- | ------------------------------------------ |
| `live_session.json`         | Box      | Hivetool | Session bundle (token, endpoint, setup)    |
| `live_result.json`          | Hivetool | Box      | Session completion signal (fallback)       |
| `tool_dispatch/{id}.json`   | Hivetool | Box      | Tool call request                          |
| `tool_dispatch/{id}.result.json` | Box | Hivetool | Tool call response                         |
| `context_updates/{ts}.json` | Box      | Hivetool | Context updates from subagent completions  |
| `live_events/{seq}.json`    | Hivetool | Box      | Structured session events (turns, tools, usage, end) |
| `chat_log.json`             | Box      | Hivetool | Transcription log (written by `drain_session`) |

---

## Phase 1 — Runner Infrastructure ✅

### 🎯 Objective

A template with `runner: live` creates a task that is dispatched to a
`LiveRunner` instead of the `GeminiRunner`. The runner extracts tool
declarations, assembles the system instruction, acquires an ephemeral token,
and writes `live_session.json` to the task directory. The `LiveStream` blocks
until `live_result.json` appears.

**Observable proof:** Create a task with `runner: live`. Observe
`live_session.json` appear in the task directory containing the token, WebSocket
endpoint, and setup message with system instruction and tool declarations.

### Changes

- [x] `ticket.py` — `RunnerType = Literal["generate", "live"]`, `runner` field
      on `TicketMetadata`.
- [x] `task_store.py`, `playbook.py` — wire `runner` through creation.
- [x] `bees.py`, `scheduler.py`, `task_runner.py` — `runners: dict[str,
      SessionRunner]` with `_runner_for(task)` dispatch.
- [x] `box.py`, `server.py` — construct `{"generate": ..., "live": ...}`.
- [x] `SessionConfiguration` — add `ticket_id`, `ticket_dir`.
- [x] `bees/runners/live.py` — `LiveRunner`, `LiveStream`, declaration
      extraction, system instruction assembly, bundle writing.
- [x] 20 tests for LiveRunner/LiveStream, 414 total passing.

---

## Phase 2 — WebSocket Session Client ✅

### 🎯 Objective

Hivetool detects `live_session.json` in a task directory, opens a WebSocket to
the Gemini Live API, and sends the setup message. On session end, it writes
`live_result.json`. No audio yet — text-only proves the WebSocket lifecycle.

**Observable proof:** Start a `runner: live` task. Hivetool reads the bundle,
connects to the Live API, and logs "session connected" in the console.
Disconnecting writes `live_result.json`, and the box's LiveStream unblocks.

### Changes

- [x] `common/types.ts` — add `runner?: string` to `TaskData`.
- [x] `hivetool/src/data/live-session.ts` — **[NEW]** `LiveSessionClient`:
      reads bundle, opens WebSocket, sends setup, handles messages, writes
      result.
- [x] `hivetool/src/data/ticket-store.ts` — on scan, check for
      `live_session.json` and surface active live sessions via
      `activeLiveSessions` signal.
- [x] `hivetool/src/ui/ticket-detail.ts` — live session panel with
      connect/disconnect, status indicator, and transcript display.

---

## Phase 3 — Audio I/O ✅

### 🎯 Objective

Speak into the microphone, hear the agent respond. Audio streams bidirectionally
over the Live API WebSocket.

**Observable proof:** Start a live session. Click a mic button. Speak a
greeting. Hear the agent respond with a voice. The conversation is natural and
low-latency.

### Changes

- [x] `hivetool/src/data/audio-handler.ts` — **[NEW]** `AudioInput` (mic →
      PCM → base64 → WS) and `AudioOutput` (WS → PCM → AudioContext →
      speakers).
- [x] `AudioInput` — `navigator.mediaDevices.getUserMedia()`, `AudioWorklet`
      for PCM capture at 16kHz mono.
- [x] `AudioOutput` — decode base64 PCM, queue into `AudioContext` playback
      buffer.
- [x] Wire audio handler into `LiveSessionClient` message loop.
- [x] Mic toggle button in ticket detail UI.
- [x] Fix binary Blob frame decoding (`#handleMessage`) — the Live API sends
      all frames as binary, not text.

---

## Phase 4 — Tool Dispatch Relay ✅

### 🎯 Objective

The Live API can call bees' Python tool handlers. Tool calls from the WebSocket
bounce through the filesystem to the box, which executes the handler and returns
the result.

**Observable proof:** Start a live audio session with an agent that has file
tools. Ask the agent to list files. The tool call appears in
`tool_dispatch/`, the box executes `simple_files_list_files`, the result is
written back, hivetool relays it to the WebSocket, and the agent reports the
file listing.

### Changes

- [x] `bees/runners/live.py` — refactored `_extract_declarations` to return
      handler map alongside declarations.
- [x] `bees/runners/live.py` — `ToolDispatchWatcher`: poll-based async loop
      on `tool_dispatch/` directory. Reads call JSON (wire format), looks up
      handler in provisioned function groups, writes result JSON.
- [x] `LiveRunner.run()` — starts `ToolDispatchWatcher` as background task.
      `LiveStream` cancels it on session end.
- [x] `LiveSessionClient` — write `tool_dispatch/{call_id}.json` on
      `toolCall` message. Observe with `FileSystemObserver` for `.result.json`.
      Send `toolResponse` on WS. Polling fallback when observer unavailable.
- [x] Dispatch files use Gemini wire format (`functionCall`/`functionResponse`
      envelopes) for observability.
- [x] Error handling: unknown handlers, handler exceptions, and 60s timeout
      all write error results to prevent hangs.
- [x] 28 tests passing (8 new for watcher, handler extraction, and lifecycle).

---

## Phase 5 — Context Updates & Transcription ✅

### 🎯 Objective

Context updates from subagent completions reach the live session. The
conversation is logged to `chat_log.json` for post-session review.

**Observable proof:** During a live session, a subagent completes and its
outcome is injected as a context update. The agent acknowledges the new
information in its next response. After the session ends, `chat_log.json`
contains the full conversation transcript.

### Changes

- [x] `LiveRunner.run()` — creates `context_updates/` eagerly so the
      browser observer can start immediately.
- [x] `LiveSessionClient` — `FileSystemObserver` on `context_updates/`
      directory. On new file, reads parts and sends as `clientContent` on WS.
      Polling fallback when observer unavailable.
- [x] Transcript is turn-delimited (newline on `turnComplete`) with
      `[Context update: ...]` markers for injected updates.
- [x] `LiveStream.send_context()` — already implemented (writes to
      `context_updates/` on box side).

---

## Phase 6 — Live Session Logging ✅

### 🎯 Objective

Live sessions produce the same `*.log.json` files as batch sessions, appearing
in the existing log viewer alongside them. The box is the sole writer.

**Observable proof:** After a live session ends, open the log viewer → the
session appears in the sidebar. Click it → timeline shows turns, tool calls,
system instruction, and context updates. Token bars show data if the Live API
reported `usageMetadata`.

### Architecture: Event Channel

The browser writes structured event files to `live_events/` (sequenced
`{seq:06d}.json`). The box's `LiveStream` polls these files and translates
each into `EvalCollector`-compatible events. `drain_session` processes them
normally, producing log files and `chat_log.json` — same as batch sessions.

| Event type       | When written                    | EvalCollector translation                  |
| ---------------- | ------------------------------- | ----------------------------------------- |
| `sessionStart`   | After `setupComplete`          | Sets config. First `sendRequest` body.     |
| `turnComplete`   | On `serverContent.turnComplete` | `sendRequest` event (with context so far)  |
| `toolCall`       | On `toolCall` message          | `functionCall` event(s)                   |
| `toolResponse`   | After dispatch result relayed   | Context entry (`user` + `functionResponse`) |
| `usageMetadata`  | On `usageMetadata` message      | `usageMetadata` event                     |
| `contextUpdate`  | On context injection            | Context entry (`user` + text parts)        |
| `sessionEnd`     | On WS close / disconnect        | `complete` event                          |

### Changes

- [x] `LiveStream` — rewritten from single-shot poll to event channel reader.
      Polls `live_events/` by sequence number, maintains context accumulator,
      translates events to `EvalCollector` format. Falls back to
      `live_result.json` for crash recovery.
- [x] `LiveRunner.run()` — creates `live_events/` eagerly, passes `setup`
      config to `LiveStream` constructor.
- [x] `_clean_stale_artifacts()` — also cleans stale `live_events/`.
- [x] `LiveSessionClient` — removed all browser-side log accumulation
      (`#logContext`, `#logTurns`, `#writeSessionLog()`, `#chatLog`,
      `#persistChatLog()`, `#logsDir`).
- [x] `LiveSessionClient` — added `#writeEvent(type, data)` helper and
      event writing at all turn boundaries.
- [x] `ticket-detail.ts` — removed `logsDir` resolution and passing.
- [x] `ticket-store.ts` — removed `getLogsDir()`.
- [x] `ChatLogEntry` type removed (unused).
- [x] 10 new tests for event channel (9 event types + context accumulation
      across turns), 2 fallback tests preserved.

---

## Phase 7 — Live Function Group

### 🎯 Objective

Live sessions use a voice-native system prompt instead of the batch-oriented
`system.*` instruction. The live agent is a friendly conversational assistant
that fulfills objectives through natural voice dialogue, not a rigid meta-plan
executor.

**Observable proof:** Start a live session. The agent responds conversationally
in a natural voice, uses tools when needed, and signals completion via
`system_objective_fulfilled` — without the stilted Cynefin/meta-plan framing
visible in its behavior. The system prompt in `log.json` shows only the
`live.*` instruction, not `system.*`.

### Bug Fix: Instruction Leak

`provision_session()` constructs *all* function group factories (system,
simple-files, skills, sandbox, events, tasks, chat) regardless of the
template's `functions` filter. The filter only gates which *declarations* are
sent to the API — every group's instruction text still gets concatenated into
the system prompt. This means a `runner: live` template with
`functions: [system.*]` still gets instructions for files, skills, sandbox,
events, tasks, and chat.

Fix: `_extract_declarations()` must skip instructions from groups whose
declarations are entirely filtered out.

### Changes

- [x] `bees/declarations/live.*` — **[NEW]** Instruction-only declaration
      files: `live.instruction.md` (voice-native system prompt),
      `live.functions.json` (empty `[]`), `live.metadata.json` (empty `{}`).
- [x] `bees/functions/live.py` — **[NEW]** `get_live_function_group()` —
      instruction-only `FunctionGroup` (same pattern as `skills.py`).
- [x] `bees/provisioner.py` — add `get_live_function_group()` to the
      function groups list.
- [x] `bees/runners/live.py` — fix `_extract_declarations()` to skip
      instructions from groups whose declarations are entirely filtered out.
- [x] `TEMPLATES.yaml` — live-session template uses `live.*` instead of
      `system.*`.
- [x] Tests for instruction filtering and live prompt assembly.
- [ ] `live.*` should carry termination declarations + handlers so
      `system.*` is not needed in the template. Currently blocked by
      `simple-files` naming (all functions prefixed `system_`).

---

## Phase 8 — UI Polish

### 🎯 Objective

Live sessions have a dedicated UI panel in ticket detail: connection status,
mic toggle, waveform visualizer, and live transcript.

**Observable proof:** Select a live-running task in hivetool. See a "Live
Session" panel with a glowing dot for connection status, a mic button, and a
scrolling transcript of the conversation.

### Changes

- [ ] `ticket-detail.ts` — render live session panel when
      `ticket.runner === "live"` and session is active.
- [ ] Connection status indicator (connecting / connected / disconnected).
- [ ] Mic toggle button with visual feedback.
- [ ] Audio level waveform or VU meter.
- [ ] Live transcript display (from server-side text events).
- [ ] Coalesce same-role transcript fragments in `LiveStream` before
      writing to context (the Live API sends `outputTranscription`
      word-by-word, producing ~80 context entries for a few sentences).

---

## Non-Goals

- **Audio processing in Python.** Audio stays entirely in the browser.
  The box never touches audio data.
- **Live API resume.** The Live API doesn't support session resume the same
  way batch does. A disconnected live session is a new session.
- **Multi-user live sessions.** One browser tab per live session.
- **Custom voice models.** Uses Gemini's built-in voice configuration.

## File Map

```
packages/bees/
  bees/
    runners/
      live.py                    ← LiveRunner, LiveStream (Phase 1 ✅)
    ticket.py                    ← RunnerType, runner field (Phase 1 ✅)
    task_runner.py               ← _runner_for() dispatch (Phase 1 ✅)
  common/
    types.ts                     ← runner field on TaskData (Phase 2)
  hivetool/src/
    data/
      live-session.ts            ← [NEW] LiveSessionClient (Phase 2)
      audio-handler.ts           ← [NEW] AudioInput, AudioOutput (Phase 3)
      ticket-store.ts            ← live session detection (Phase 2)
    ui/
      ticket-detail.ts           ← live session panel (Phase 7)
  tests/
    test_live_runner.py          ← LiveRunner tests (Phase 1 ✅)
```
