# Project Air — Asynchronous Unified Tasks

Bees agents execute tools synchronously: when a tool like `generate_text` or
`generate_images` is called, the agent's cognitive loop blocks for 20-40 seconds
while waiting for the downstream model or media service to respond. This
prevents parallel execution, blocks real-time UI feedback, and locks the agent
into a single-threaded execution model.

Rather than inventing a custom async function registry, a volatile background
loop, and new Hivetool telemetry widgets, **Project Air unifies async executions
under the Task abstraction**.

Long-running model calls (like `generate_text` and `generate_images`) are
treated as **finite, single-turn agent tasks** (sub-agents) rather than simple
functions.

---

## The Unified Task Model

When the agent requests a text generation, it spawns a child task of type
`"generate_text"`.

By passing a folder name as the child task's **`slug`** (e.g., `slug="memo"`),
the child's deliverables are cleanly sandboxed under the `memo/` directory (e.g.
`memo/text.md`), fully enforced by the existing `SubagentScope` validation:

```
Parent Agent Loop
  ├── Calls tasks_create_task(type="generate_text", objective="...", slug="memo")
  │     └── Returns immediately: { "task_id": "task-uuid-123", "status": "pending" }
  │
  ├── Calls tasks_check_status()
  │     └── Returns: [ { "task_id": "task-uuid-123", "status": "running" } ]
  │
  ├── Suspends via chat_await_context_update()
  │
  └── [Child Generation Task completes]
        ├── Writes output directly to: "memo/text.md"
        └── Delivers task completion context update to Parent
              └── Parent resumes with:
                  {
                    "task_id": "task-uuid-123",
                    "status": "completed",
                    "outcome": "Result written to memo/text.md"
                  }
```

### Why This Model is Architecturally Superior

1. **Instant Durability for Free**: Because every generation call is a `Ticket`
   in `TaskStore`, it is **inherently durable**. If the server process crashes
   or restarts, the task recoveries and loop resumptions handle generation calls
   automatically without custom code.
2. **Clean Deliverables Sandboxing via Slugs**:
   - The task's `slug` defines its directory namespace (e.g. `slug="memo"`).
   - The child's `SubagentScope` limits writing to this namespace. The child
     generation task writes `memo/text.md` (or `memo/image_0.png`), keeping the
     parent's root directory clean and organized.
   - Concurrent generations (e.g., three parallel search queries) run with
     separate slugs (`slug="search-1"`, `slug="search-2"`), ensuring perfect
     workspace isolation and zero filesystem collisions.
3. **Perfect Session Rollback Integration**: If a session is rolled back
   (Project Rewind) to turn 3, the rollback mutation naturally scans the task
   tree to cancel and delete child tasks spawned after turn 3—including any
   active generation tasks.
4. **100% Telemetry & UI Reuse**: Because they are standard tasks, active
   generations automatically appear in Hivetool's existing sidebar and session
   detail panes as live task spinner cards, showing streaming thoughts and
   execution logs with zero UI modifications.
5. **Absolute Conceptual Simplicity**: By eliminating the function-to-task
   "interception layer" entirely and updating our task templates and skills
   directly, we completely remove the need for a legacy `generate` function
   group in Bees. The LLM only ever interacts with a single execution concept:
   **Tasks**.

---

## Core Concepts

### 1. The `direct_model` Runner

A new kind of `SessionRunner` registered in the `Bees` runner list. It
implements the standard `SessionRunner` and `SessionStream` protocols:

- It extracts the prompt/input verbatim from the task's `objective`.
- It resolves the output directory from the task's `slug` metadata (which acts
  as the child task's write sandbox).
- It delegates actual execution to a pluggable **Gen-Adapter** resolved
  dynamically using the task's `tags` metadata.
- On completion, the adapter writes the final deliverable files to the path
  authorized by its `slug` scope (e.g. `memo/text.md`) via the workspace
  `FileSystem`, yields a `CompleteEvent`, and ends.
- It returns `None` for `resume_state` as it never suspends.

### 2. The Pluggable Gen-Adapter Architecture

To handle different generation types (text, images, video, music, speech)
cleanly and support arbitrary user-defined templates (like
`generate_cat_video`), we use a pluggable dispatch registry of Gen-Adapters
resolved dynamically by the task's **`tags`** metadata:

```
                     ┌───────────────────────┐
                     │   DirectModelRunner   │
                     └───────────┬───────────┘
                                 │ (dispatches by task tags)
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TextAdapter   │     │  ImageAdapter   │     │  VideoAdapter   │
│ (Gemini Stream) │     │ (ai_image_tool) │     │ (Veo Generator) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Each Gen-Adapter implements the execution and handles type-specific quirks:

#### A. Text Generation (`type: "generate_text"`)

- **API Call**: Gemini model text generation (`stream_generate_content`).
- **Quirks**:
  - Uses `thinkingConfig` when using the `"pro"` model to stream live reasoning.
  - Yields thought events `{"thought": {"text": chunk}}` to drive real-time
    Hivetool timeline rendering.
  - Writes a single Markdown/Text output to `slug/text.md`.

#### B. Image Generation (`type: "generate_images"`)

- **API Call**: AI Image Tool `execute_step` with `ai_image_tool` model API.
- **Quirks**:
  - Translates and base64 encodes any input images.
  - Resolves `aspect_ratio` from task metadata or parses it from instructions
    (defaults to 16:9).
  - Writes consecutive binary PNG deliverables: `slug/image_0.png`,
    `slug/image_1.png`, etc.

#### C. Video Generation (`type: "generate_video"`)

- **API Call**: Veo video generation `execute_step` with `generate_video` model
  API.
- **Quirks**:
  - Performs Veo error support code expansion (e.g., celebrity, toxic, unsafe
    face detection errors) via a cloned `expand_veo_error` utility, ensuring
    full diagnostics.
  - Writes binary video output to `slug/video_0.mp4`.

#### D. Speech / Music Generation (`type: "generate_speech_from_text"`, `"generate_music_from_text"`)

- **API Call**: TTS/Music `execute_step` with `tts` or `generate_music` model
  APIs.
- **Quirks**:
  - Translates voice presets (e.g., female/male voices for TTS).
  - Writes binary audio deliverables: `slug/audio_0.mp3` or `slug/audio_0.wav`.

---

## Unified Declarative Task Template Syntax

Task templates are defined natively inside `hives/{hive}/config/TEMPLATES.yaml`
(or within local `templates/*.yaml` task files).

To declare a new kind of direct generation task, users simply specify
`runner: direct_model` in their template options. The scheduler handles mappings
and execution entirely automatically:

### 1. Video Generation Template (`generate_video.yaml`)

```yaml
- name: generate_video
  title: AI Video Generator
  description: Natively generates a high-fidelity video based on a text prompt.
  runner: direct_model # ◄── Executes via DirectModelRunner
  model: veo-3.1-generate-preview # ◄── The specific downstream generation model
  tags:
    - video # ◄── Tells DirectModelRunner to use VideoAdapter
  objective: >-
    Provide a descriptive, clear subject, action, camera direction, and style.
    Your final video will be output directly to your workspace path.
```

### 2. Image Generation Template (`generate_images.yaml`)

```yaml
- name: generate_images
  title: AI Image Generator
  description: Natively generates high-fidelity images based on a prompt.
  runner: direct_model
  model: gemini-3-pro-image-preview
  tags:
    - image # ◄── Tells DirectModelRunner to use ImageAdapter
  objective: >-
    Describe the scene narrative as descriptive as possible. 
    Your final image will be output directly to your workspace path.
```

### How the Agent Invokes a Generation Task

When the agent wants to spawn a video generation, it simply uses the standard
`tasks_create_task` tool call. The prompt is passed in the `objective`
parameter, and the target folder in the `slug` parameter:

```json
{
  "type": "generate_video",
  "summary": "Cinematic sunset video",
  "slug": "intro_video",
  "objective": "A wide cinematic shot of a vibrant sunset over rolling mountains, eye-level view, shallow focus, cinematic style."
}
```

---

## Phase 1 — `direct_model` Core & Text Generation Adapter

### 🎯 Objective

Implement the core `direct_model` runner, register it natively in `Bees`, and
build the baseline `TextAdapter` to execute concurrent, non-blocking text
generation tasks.

**Observable proof:** Trigger a sub-task of `type: "generate_text"` with
`slug: "memo"`. Verify that it executes under `DirectModelRunner`, streams
thoughts live to Hivetool, writes the completed output text to `memo/text.md`,
and resolves task status to completed.

### Changes

- [ ] **[MODIFY]
      [ticket.py](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/ticket.py)**
  - Update `RunnerType` literal definition to support `"direct_model"`.
- [ ] **[NEW]
      [direct_model.py](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/runners/direct_model.py)**
  - Implement `DirectModelRunner` and `DirectModelStream` implementing
    `SessionRunner` and `SessionStream` protocols.
  - Implement base Gen-Adapter dispatch routing using task `tags`.
  - Implement the **`TextAdapter`**:
    - Translates pidgin prompt string using `from_pidgin_string`.
    - Calls `stream_generate_content` via `gemini_client`.
    - Yields live thought chunks to driving SSE.
    - Writes final generated text to `slug/text.md` on completion.
- [ ] **[MODIFY]
      [box.py](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/box.py)**
  - Register `"direct_model"` runner in the starting dictionary.
- [ ] **[NEW]
      [generate_text.yaml](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/declarations/tasks/generate_text.yaml)**
  - Register built-in template for `generate_text` specifying
    `runner: direct_model`, `tags: ["text"]`, and model defaults.

#### Verification

- [ ] Add automated test `test_direct_model_text.py` to verify
      `DirectModelRunner` core execution, text generation, thought streaming,
      and sandboxed file generation in isolation.

---

## Phase 2 — Task Template & Skill Refactoring

### 🎯 Objective

Refactor task templates and skills to migrate away from the legacy
`generate.text` function tools, directing agents to natively use the standard
`tasks` tool for concurrent text generation.

**Observable proof:** Run a task in Bees that executes the updated task
template/skill instructions. Verify that the parent agent loops successfully
spawn child `generate_text` tasks to execute model calls, and continue executing
after receiving deliverables inside `memo/text.md`.

### Changes

- [ ] **[MODIFY]
      [TEMPLATES.yaml](file:///Users/dglazkov/Documents/code/breadboard/hives/chat-app/config/TEMPLATES.yaml)**
  - Under templates `chat-chat` and `chat-3`:
    - Remove `generate.text` from the allowed `functions:` allowlist.
    - Add `tasks.*` to the allowed functions list if not already present.
    - Update their `objective` instructions to guide the agent: replace
      references of calling the `generate_text` function with instructions to
      spawn a `generate_text` sub-task with `slug` set to the desired folder
      name.
- [ ] **[MODIFY]
      [SKILL.md](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/hive/skills/research/SKILL.md)**
  - Remove `generate.text` from the allowed-tools header list.
  - Add `tasks.*` to the allowed-tools list.
  - Update Step 3: "Create a child task of type `generate_text` with `slug` set
    to your target directory (e.g. `search_1`) and `objective` set to your query
    in parallel."
  - Update Rule 2 to guide the agent to spawn multiple parallel `generate_text`
    child tasks instead of concurrent function calls.

#### Verification

- [ ] Run the updated `chat-chat` or `chat-3` agent sessions end-to-end and
      verify they execute concurrent tasks for generation seamlessly.

---

## Phase 3 — Image Generation Adapter (`generate_images`)

### 🎯 Objective

Implement the pluggable `ImageAdapter` to execute concurrent, non-blocking image
generation tasks.

**Observable proof:** Trigger a child task of `type: "generate_images"` with
`slug: "logo"` and `objective: "A sleek vector logo of a bee"`. Once it
completes, verify that `logo/image_0.png` appears in the parent workspace
containing the generated image.

### Changes

- [ ] **[MODIFY]
      [direct_model.py](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/runners/direct_model.py)**
  - Implement and register the **`ImageAdapter`**:
    - Resolves input reference images from the objective.
    - Runs the `ai_image_tool` plan step execution via `execute_step`.
    - Decodes output chunks and writes consecutive binary PNGs to
      `slug/image_N.png`.
- [ ] **[NEW]
      [generate_images.yaml](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/declarations/tasks/generate_images.yaml)**
  - Register built-in template for `generate_images` specifying
    `runner: direct_model`, `tags: ["image"]`, and model defaults.
- [ ] **[MODIFY]
      [log-detail.ts](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/hivetool/src/ui/log-detail.ts)**
  - Enhance Hivetool to recognize completed `generate_images` child tasks and
    render the `.png` deliverables directly in the logs pane as an inline image.

#### Verification

- [ ] Add automated test `test_direct_model_image.py` to verify `ImageAdapter`
      execution, input image marshalling, and PNG file outputs.

---

## Phase 4 — Advanced Media Gen-Adapters (Video, Speech, Music)

### 🎯 Objective

Implement specialized plan-step Gen-Adapters to support video, speech, and music
generation tasks.

**Observable proof:** Trigger a `generate_video` sub-task. Verify that it
executes under the specialized `VideoAdapter` and produces `slug/video_0.mp4`
correctly. Trigger speech or music tasks and verify they produce audio
`.mp3`/`.wav` deliverables.

### Changes

- [ ] **[MODIFY]
      [direct_model.py](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/runners/direct_model.py)**
  - Implement and register the **`VideoAdapter`**:
    - Runs `generate_video` step execution.
    - Integrates Veo safety diagnostics (`expand_veo_error`).
    - Writes binary output to `slug/video_0.mp4`.
  - Implement and register **`SpeechAdapter`** and **`MusicAdapter`**:
    - Runs TTS and music plan steps.
    - Translates voices and presets.
    - Writes audio outputs `slug/audio_0.mp3` or `slug/audio_0.wav`.
- [ ] **[NEW] Task templates**:
  - Create `generate_video.yaml`, `generate_speech.yaml`, and
    `generate_music.yaml` specifying `runner: direct_model` and their respective
    `tags`.

#### Verification

- [ ] Add automated tests `test_direct_model_media.py` verifying
      video/speech/music adapters execution and binary file generations in
      isolation.

---

## Phase 5 — Rollback Integration & Telemetry Polish

### 🎯 Objective

Ensure absolute session rollback safety for background calls and child tasks,
and add premium log details rendering in Hivetool.

**Observable proof:** Run a multi-turn session, trigger a rollback in Hivetool,
and verify that any active child generation tasks spawned in rolled-back turns
are cleanly deleted/cancelled from the `TaskStore` and `Scheduler`. completed
deliverables (.md, .png, .mp4, .mp3) are cleanly rendered in the logs panel with
inline preview widgets.

### Changes

- [ ] **[MODIFY]
      [mutations.py](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/bees/mutations.py)**
  - Enhance the `rollback-to-turn` handler to search the active task tree for
    any child tasks spawned after the rollback point's turn boundaries and
    recursively delete/cancel them.
- [ ] **[MODIFY]
      [log-detail.ts](file:///Users/dglazkov/Documents/code/breadboard/packages/bees/hivetool/src/ui/log-detail.ts)**
  - Style child task cards premium-ly. Add rich inline widgets to preview
    markdown, image, video, and audio deliverables directly in the timeline
    under their spawning turn.

---

## Non-Goals

- **Durable background execution of external third-party MCP calls**: Volatile
  background calls made through third-party MCP servers are out of scope for
  task-level unification. Only core model and image generation tasks are handled
  in this phase.
- **Real-time interactive terminal inputs within leaf agents**: Spawning
  interactive prompts within a direct_model session. It remains strictly
  non-interactive.

## File Map

```
packages/bees/
  bees/
    scheduler.py                 ← remains clean (termination only)
    runners/
      direct_model.py            ← [NEW] DirectModelRunner and DirectModelStream (SessionRunner protocols)
    functions/
      tasks.py                   ← ensure child slug parameters are wired
    declarations/
      tasks/
        generate_text.yaml       ← [NEW] template defining generate_text built-in runner
        generate_images.yaml     ← [NEW] template defining generate_images built-in runner
        generate_video.yaml      ← [NEW] template defining generate_video built-in runner
        generate_speech.yaml     ← [NEW] template defining generate_speech built-in runner
        generate_music.yaml      ← [NEW] template defining generate_music built-in runner
  tests/
    test_direct_model_text.py    ← [NEW] verify text adapter execution and thoughts
    test_direct_model_image.py   ← [NEW] verify image adapter execution and PNG outputs
    test_direct_model_media.py   ← [NEW] verify video, audio, speech adapter executions
```

## Context for New Sessions

### original implementations in opal-backend

| File                                                            | What to learn                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/opal-backend/opal_backend/functions/generate.py`      | The synchronous implementations of `generate_text` and `generate_images`. |
| `packages/opal-backend/opal_backend/declarations/generate.json` | Original function schemas and guidelines.                                 |

### task orchestration in bees

| File                                   | What to learn                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/bees/bees/scheduler.py`      | Understand cycle loops, stuck recovery, and the delivery path for context updates. |
| `packages/bees/bees/runners/gemini.py` | Implementation of standard GeminiRunner and its event streaming.                   |
| `packages/bees/bees/task_runner.py`    | Understand the pipeline of starting/resuming tasks and extracting files.           |
