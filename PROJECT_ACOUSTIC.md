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
runs the audio loop. Tool calls bounce through `tool_dispatch/` files. The
LiveStream blocks until `live_result.json` appears, then the scheduler resumes
normal task lifecycle processing.

## Communication Protocol

All communication between box and browser uses the task directory on the
shared filesystem:

| File                        | Writer   | Reader   | Purpose                                    |
| --------------------------- | -------- | -------- | ------------------------------------------ |
| `live_session.json`         | Box      | Hivetool | Session bundle (token, endpoint, setup)    |
| `live_result.json`          | Hivetool | Box      | Session completion signal                  |
| `tool_dispatch/{id}.json`   | Hivetool | Box      | Tool call request                          |
| `tool_dispatch/{id}.result.json` | Box | Hivetool | Tool call response                         |
| `context_updates/{ts}.json` | Box      | Hivetool | Context updates from subagent completions  |
| `chat_log.json`             | Hivetool | Box      | Transcription log                          |

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

## Phase 4 — Tool Dispatch Relay

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

- [ ] `LiveSessionClient` — write `tool_dispatch/{call_id}.json` on
      `toolCall` message. Watch for `.result.json`. Send `toolResponse` on WS.
- [ ] `bees/runners/live.py` — `ToolDispatchWatcher`: async loop using
      `awatch` on `tool_dispatch/` directory. Reads call JSON, looks up handler
      via `TrampolineRegistry`, writes result JSON.
- [ ] Wire watcher into `LiveStream` or `LiveRunner` lifecycle.
- [ ] Handle dispatch timeout and error cases.

---

## Phase 5 — Context Updates & Transcription

### 🎯 Objective

Context updates from subagent completions reach the live session. The
conversation is logged to `chat_log.json` for post-session review.

**Observable proof:** During a live session, a subagent completes and its
outcome is injected as a context update. The agent acknowledges the new
information in its next response. After the session ends, `chat_log.json`
contains the full conversation transcript.

### Changes

- [ ] `LiveSessionClient` — watch `context_updates/` directory. On new file,
      read it and call `session.send(clientContent)` on the WebSocket.
- [ ] `LiveSessionClient` — extract text transcriptions from server messages,
      append to `chat_log.json`.
- [ ] `LiveStream.send_context()` — already implemented (writes to
      `context_updates/` on box side).

---

## Phase 6 — UI Polish

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
      ticket-detail.ts           ← live session panel (Phase 6)
  tests/
    test_live_runner.py          ← LiveRunner tests (Phase 1 ✅)
```
