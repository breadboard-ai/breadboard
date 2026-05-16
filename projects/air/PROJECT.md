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
│ (Gemini Stream) │     │  (Gemini REST)  │     │ (Veo Generator) │
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

- **API Call**: Gemini REST API (`gemini-3.1-flash-image-preview` `generateContent`).
- **Quirks**:
  - Extracts prompt string from `objective.md` or input segments.
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
  model: gemini-3.1-flash-image-preview
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

- [x] **[MODIFY]
      [ticket.py](packages/bees/bees/ticket.py)**
  - Update `RunnerType` literal definition to support `"direct_model"`.
- [x] **[NEW]
      [direct_model.py](packages/bees/bees/runners/direct_model.py)**
  - Implement `DirectModelRunner` and `DirectModelStream` implementing
    `SessionRunner` and `SessionStream` protocols.
  - Implement base Gen-Adapter dispatch routing using task `tags`.
  - Implement the **`TextAdapter`**:
    - Translates pidgin prompt string using `from_pidgin_string`.
    - Calls `stream_generate_content` via `gemini_client`.
    - Yields live thought chunks to driving SSE.
    - Writes final generated text to `slug/text.md` on completion.
- [x] **[MODIFY]
      [box.py](packages/bees/bees/box.py)**
  - Register `"direct_model"` runner in the starting dictionary.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Define the `generate_text` task template specifying `runner: direct_model`, `model: gemini-3-flash-preview`, `objective: "{{system.context}}"`, and support for `builtin.search_grounding` in functions.

#### Verification

- [x] Add automated test `test_direct_model_text.py` to verify
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

- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Under templates `chat-chat` and `chat-3`:
    - Remove `generate.text` from the allowed `functions:` allowlist.
    - Add `tasks.*` to the allowed functions list if not already present.
    - Update their `objective` instructions to guide the agent: replace
      references of calling the `generate_text` function with instructions to
      spawn a `generate_text` sub-task with `slug` set to the desired folder
      name.
- [x] **[MODIFY]
      [SKILL.md](packages/bees/hive/skills/research/SKILL.md)**
  - Remove `generate.text` from the allowed-tools header list.
  - Add `tasks.*` to the allowed-tools list.
  - Update Step 3: "Create a child task of type `generate_text` with `slug` set
    to your target directory (e.g. `search_1`) and `objective` set to your query
    in parallel."
  - Update Rule 2 to guide the agent to spawn multiple parallel `generate_text`
    child tasks instead of concurrent function calls.

#### Verification

- [x] Run the updated `chat-chat` or `chat-3` agent sessions end-to-end and
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

- [x] **[MODIFY]
      [direct_model.py](packages/bees/bees/runners/direct_model.py)**
  - Implement and register the **`ImageAdapter`**:
    - Uses `httpx` to call `gemini-3.1-flash-image-preview` directly via Gemini REST API.
    - Decodes `inlineData` and writes consecutive binary PNGs to `slug/image_N.png`.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Register built-in template for `generate_images` specifying `runner: direct_model`, `tags: ["image"]`, and model defaults.
- [x] **[MODIFY]
      [log-detail.ts](packages/bees/hivetool/src/ui/log-detail.ts)**
  - Enhance Hivetool to recognize completed `generate_images` child tasks and
    render the `.png` deliverables directly in the logs pane as an inline image.

#### Verification

- [x] Add automated test `test_direct_model_image.py` to verify `ImageAdapter`
      execution, REST API payload structure, and PNG file outputs.

---

## Phase 4.1 — Video Generation Adapter (`generate_video`)

### 🎯 Objective

Implement specialized `VideoAdapter` to support concurrent video generation tasks directly via REST API.

**Observable proof:** Trigger a `generate_video` sub-task. Verify that it executes under `VideoAdapter` via direct REST API calls (bypassing `opal-backend`) and produces `slug/video_0.mp4` correctly.

### Changes

- [x] **[MODIFY]
      [direct_model.py](packages/bees/bees/runners/direct_model.py)**
  - Implement and register the **`VideoAdapter`**:
    - Uses `httpx` to call Veo video generation REST API directly.
    - Integrates Veo safety diagnostics (`expand_veo_error`).
    - Writes binary output to `slug/video_0.mp4`.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Register built-in template for `generate_video` specifying `runner: direct_model` and `tags: ["video"]`.

#### Verification

- [x] Add automated test `test_direct_model_video.py` verifying `VideoAdapter` execution and mp4 file generation in isolation.

---

## Phase 4.2 — Speech Generation Adapter (`generate_speech`)

### 🎯 Objective

Implement specialized `SpeechAdapter` to support concurrent speech generation (TTS) tasks directly via REST API.

**Observable proof:** Trigger a `generate_speech` sub-task. Verify that it executes under `SpeechAdapter` via direct REST API calls (bypassing `opal-backend`) and produces `slug/audio_0.wav` correctly.

### Changes

- [x] **[MODIFY]
      [direct_model.py](packages/bees/bees/runners/direct_model.py)**
  - Implement and register the **`SpeechAdapter`**:
    - Uses `httpx` to call TTS REST API directly.
    - Translates voice presets and parameters.
    - Writes binary output to `slug/audio_0.wav`.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Register built-in template for `generate_speech` specifying `runner: direct_model` and `tags: ["speech"]`.

#### Verification

- [x] Add automated test `test_direct_model_speech.py` verifying `SpeechAdapter` execution and wav file generation in isolation.

---

## Phase 4.3 — Music Generation Adapter (`generate_music`)

### 🎯 Objective

Implement specialized `MusicAdapter` to support concurrent music generation tasks directly via REST API.

**Observable proof:** Trigger a `generate_music` sub-task. Verify that it executes under `MusicAdapter` via direct REST API calls (bypassing `opal-backend`) and produces `slug/audio_0.wav` correctly.

### Changes

- [x] **[MODIFY]
      [direct_model.py](packages/bees/bees/runners/direct_model.py)**
  - Implement and register the **`MusicAdapter`**:
    - Uses `httpx` to call MusicFX REST API directly.
    - Writes binary output to `slug/audio_0.wav`.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Register built-in template for `generate_music` specifying `runner: direct_model` and `tags: ["music"]`.

#### Verification

- [x] Add automated test `test_direct_model_music.py` verifying `MusicAdapter` execution and wav file generation in isolation.

---

## Phase 5 — Core Plumbing: Dynamic Task Configuration Overrides

### 🎯 Objective

Establish a robust architectural pattern to allow agents to supply runtime configuration overrides (e.g., aspect ratio, resolution, voice presets) when spawning tasks, solving the combinatorial template explosion without confusing the LLM or violating abstraction boundaries.

**Observable proof:** Trigger a child task of `type: "generate_images"` passing `options: {"aspect_ratio": "16:9", "image_size": "4K"}`. Verify that the options are validated against the template's `options_schema`, successfully persisted into `TicketMetadata`, and made available to downstream Gen-Adapters. Pass an invalid option key `{"ratio": "16:9"}` and verify that `tasks_create_task` rejects it with a descriptive tool validation error string.

### Finalized Architectural Decision: Dynamic Template Schemas + Engine Validation

To maintain a pristine tool catalog without sacrificing schema validation or LLM prompting accuracy, we adopt a declarative, template-driven approach:
1. **Agnostic Spawning Tool:** `tasks_create_task` exposes a generic, open `options: object` parameter, keeping the core tool registry static and decoupled from multimedia domain concepts.
2. **Declarative Template Schemas:** Each task template in `TEMPLATES.yaml` defines its own `options_schema` block (e.g., `generate_images` declares `aspect_ratio` and `image_size`).
3. **Dynamic Discovery:** `tasks_list_types` returns available tasks enriched with their specific `options_schema`, instructing the LLM exactly what keys/values matter for that task type.
4. **Active Runtime Validation:** `tasks_create_task` actively validates incoming `options` against the template's `options_schema`. If the LLM hallucinates a key or provides an invalid enum, the engine rejects the tool call with an explicit, guiding error message (e.g., `"Invalid option 'ratio'. Supported options: aspect_ratio, image_size"`), forcing immediate self-correction.

### Compiled Reference: Generator Options Matrix

This matrix compiles the available runtime configuration options across the downstream Gemini and Veo generation engines. These schemas are declared directly in `TEMPLATES.yaml` and made discoverable via `tasks_list_types`.

| Task Type | Option Key | Type | Supported Values / Descriptions | API Mapping Reference |
| :--- | :--- | :--- | :--- | :--- |
| **`generate_images`** | `aspect_ratio` | `string` | `"1:1"`, `"3:4"`, `"4:3"`, `"9:16"`, `"16:9"`, `"1:2"`, `"2:1"`, `"3:2"`, `"2:3"`, `"5:4"`, `"4:5"`, `"7:5"`, `"5:7"`, `"21:9"`, `"9:21"` | `generationConfig.responseFormat.image.aspectRatio` |
| | `image_size` | `string` | `"512"`, `"1K"`, `"2K"`, `"4K"` | `generationConfig.responseFormat.image.imageSize` |
| | `person_generation` | `string` | `"allow_all"`, `"dont_allow"`, `"allow_adult"` | `generationConfig.responseFormat.image.personGeneration` |
| **`generate_video`** | `aspect_ratio` | `string` | `"16:9"`, `"9:16"`, `"1:1"` | Veo REST `parameters.aspectRatio` |
| | `resolution` | `string` | `"720p"`, `"1080p"`, `"4k"` | Veo REST `parameters.resolution` |
| | `duration_seconds` | `number` | `4`, `6`, `8` | Veo REST `parameters.durationSeconds` |
| | `person_generation` | `string` | `"allow_all"`, `"dont_allow"`, `"allow_adult"` | Veo REST `parameters.personGeneration` |
| **`generate_speech`** | `voice` | `string` | `"Puck"`, `"Charon"`, `"Kore"`, `"Fenrir"`, `"Aoede"`, `"Zephyr"`, `"Enceladus"` (Gemini Prebuilt Voices) | REST `voiceConfig.prebuiltVoiceConfig.voiceName` |
| | `speech_speed` | `number` | `0.5` to `2.0` (Default: `1.0`) | REST `voiceConfig.speechSpeed` |

### Changes

- [x] **[MODIFY]
      [tasks.functions.json](packages/bees/bees/declarations/tasks.functions.json)**
  - Add optional `options` parameter (type `object`, `additionalProperties: true`) to `tasks_create_task` with a rich description directing the agent to check `tasks_list_types`.
- [x] **[MODIFY]
      [tasks.instruction.md](packages/bees/bees/declarations/tasks.instruction.md)**
  - Add guidance instructing the agent to inspect `options_schema` in task listings and supply valid configuration overrides via `options`.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Attach declarative `options_schema` blocks to `generate_images`, `generate_video`, `generate_speech`, and `generate_music` templates.
- [x] **[MODIFY]
      [ticket.py](packages/bees/bees/ticket.py)**
  - Add `options: dict[str, Any] | None = None` to `TicketMetadata`.
- [x] **[MODIFY]
      [playbook.py](packages/bees/bees/playbook.py)**
  - Update `run_playbook` and `stamp_child_task` to accept and serialize `options`.
- [x] **[MODIFY]
      [tasks.py](packages/bees/bees/functions/tasks.py)**
  - Update `_tasks_list_types` to pass through `options_schema` from loaded templates.
  - Update `_tasks_create_task` to validate incoming `options` against the loaded template's `options_schema`, returning a clear error dict on failure.

#### Verification

- [x] Add automated test `test_tasks_options_validation.py` verifying successful options pass-through, dynamic schema listing, and explicit validation errors on malformed keys/values.

---

## Phase 5.1 — Hivetool Options Schema & Overrides UI

### 🎯 Objective

Bring first-class frontend UI support to Hivetool for viewing, running, and editing template configuration options, bridging the gap between declarative schemas and parameterized task execution.

**Observable proof:** 
1. **View Mode:** Select the `generate_images` template in Hivetool and verify that its `options_schema` is rendered as a clean visual specification block.
2. **Run Dialog:** Click "▶ Run" on `generate_images`. Verify that the run dialog dynamically generates form controls (`<select>` dropdowns for enums) matching the template's `options_schema`. Select custom values, click "Create Task", and verify that the spawned task correctly stores the selected `options` in `metadata.json`.
3. **Edit Mode (Polish):** Implement a dedicated, user-friendly options editor in `<bees-template-detail>` to allow developers to easily configure custom `options_schema` properties without wrestling with raw YAML strings.

### Changes

- [x] **[MODIFY]
      [types.ts](packages/bees/common/types.ts)**
  - Add `options` field to `TaskData` shared contract.
- [x] **[MODIFY]
      [template-store.ts](packages/bees/hivetool/src/data/template-store.ts)**
  - Add `OptionPropertySchema` interface and `options_schema` field to `TemplateData`.
- [x] **[MODIFY]
      [ticket-store.ts](packages/bees/hivetool/src/data/ticket-store.ts)**
  - Update `createTask` to accept `options?: Record<string, unknown>` and persist it to `metadata.json`.
- [x] **[MODIFY]
      [template-detail.ts](packages/bees/hivetool/src/ui/template-detail.ts)**
  - Implement view mode rendering for `options_schema` as a "Configuration Options" block with name, type badge, enum pills, and description.
  - Update `handleRun` and `renderRunDialog` to dynamically render form inputs (`<select>` dropdowns for enum values, `<input>` for primitives) based on `options_schema`, binding selections to a local `runOptions` state, and passing them to `createTask`.
  - Implement the dedicated options schema editor in edit mode with structured key/value rows (name, type, description, enum list, delete).
- [x] **[MODIFY]
      [ticket-detail.ts](packages/bees/hivetool/src/ui/ticket-detail.ts)**
  - Display task creation options as identity-chip key-value pairs in the ticket detail view.

---

## Phase 5.2 — Image Grounding & Options Plumbing (`generate_images`)

### 🎯 Objective

Enable the `ImageAdapter` to receive reference images via pidgin file tags in
the objective and to apply runtime configuration options (aspect ratio, image
size, person generation) to the Gemini REST call.

**Observable proof:**
1. **Options plumbing:** Trigger a `generate_images` task with
   `options: { "aspect_ratio": "16:9", "image_size": "4K" }`. Verify the REST
   request includes `generationConfig.responseFormat.image` with matching
   values, and the output image reflects the requested dimensions.
2. **Image grounding:** The parent agent writes an objective containing pidgin
   file references:
   `"A group photo of these people <file src=\"face1.png\" /> <file src=\"face2.png\" /> making funny faces"`.
   Verify that `from_pidgin_string` resolves the tags into `inlineData` parts,
   that `ImageAdapter` includes them alongside text in the REST `contents`
   array, and that the generated image reflects the referenced subjects.

### Why this is a small phase

Pidgin already resolves `<file src="..." />` into `inlineData` parts via
`from_pidgin_string`. The `ImageAdapter` already calls `from_pidgin_string` on
the prompt. The only gap: **it extracts only text parts and discards everything
else** (lines 27-38). Fixing this is a targeted adapter change, not a new
architecture.

Options plumbing is similarly narrow: the `options` dict is already persisted in
`metadata.json` (Phase 5) — the adapter just needs to read and map them.

### Changes

- [x] **[MODIFY]
      [protocol.py](packages/bees/bees/runners/adapters/protocol.py)**
  - Add `options: dict[str, Any] | None = None` parameter to `GenAdapter.generate`.
- [x] **[MODIFY]
      [direct_model.py](packages/bees/bees/runners/direct_model.py)**
  - Read `options` from task `metadata.json` and pass through to `adapter.generate`.
- [x] **[MODIFY]
      [image.py](packages/bees/bees/runners/adapters/image.py)**
  - **Image grounding:** Use the full resolved `contents` from `from_pidgin_string`
    (text + `inlineData` parts) in the REST `contents` array, enabling subject
    grounding via pidgin file references.
  - **Options plumbing:** Map `aspect_ratio`, `image_size`, `person_generation`
    from `options` into `generationConfig.imageConfig`.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Add `test_image_grounding` template: a parent agent that writes a reference
    image, spawns `generate_images` with pidgin file refs and options, and
    reports the result.

#### Verification

- [ ] Run `test_image_grounding` template end-to-end and verify the generated
      image reflects the reference subject and requested aspect ratio.

---

## Phase 6 — Cinematic Video Direction, Interpolation & Continuation (`generate_video`)

### 🎯 Objective

Expose Veo 3.1's advanced control plane, enabling video continuation (extending existing
clips), keyframe interpolation (animating between two states), and precise cinematic styling.

**Observable proof:**
1. **Continuation:** Pass an active video deliverable (`video_0.mp4` from turn 1) to a new
   video task with prompt `"Track the butterfly into the garden"`. Verify Veo extends the
   existing video by 7 seconds cleanly.
2. **Interpolation:** Provide a starting frame image and an ending frame image (`lastFrame`).
   Verify Veo interpolates a seamless 720p transition between the two images.
3. **Cinematic Direction:** Request a 4K, 8-second video using 3 reference asset images.
   Verify the adapter successfully drives the long-running polling loop to produce an
   8-second 4K mp4.

### Changes

- [x] **[MODIFY]
      [video.py](packages/bees/bees/runners/adapters/video.py)**
  - Populate `aspectRatio`, `resolution`, `durationSeconds`, and `personGeneration`
    in the Veo REST `parameters` block via `_build_parameters(options)`.
  - Video continuation via `extend_video` option: reads the server-side URI from a
    sidecar file (`video_0.uri.json`) persisted after each generation. The Veo API
    requires a server-side URI reference for extension — inline bytes are rejected.
  - Keyframe interpolation via `first_frame` / `last_frame` options: resolves images
    through `FileSystem.get()` and maps to `bytesBase64Encoded` format.
  - Reference image direction via `reference_images` option: up to 3 images mapped
    to `referenceImages[]` with `referenceType: "asset"`.
  - URI sidecar persistence: after every successful generation, the `video.uri` from
    the Veo response is saved as `video_0.uri.json` for future extension.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Expanded `generate_video` template with `first_frame`, `last_frame`,
    `extend_video`, and `reference_images` options plus enriched description.
  - Added `test_video_extension` and `test_video_interpolation` parent agent
    templates for end-to-end validation.
- [x] **Protocol conformance fix:** Added `options` parameter to `TextAdapter`,
  `SpeechAdapter`, and `MusicAdapter` to match the `GenAdapter` protocol (latent
  bug — the runner was already passing `options=options` to all adapters).

---

## Phase 7 — Expressive Multi-Speaker TTS & Voice Catalog (`generate_speech`)

### 🎯 Objective

Elevate the `SpeechAdapter` to full fidelity, matching the pattern established
by Phase 5.2 (image grounding + options) and Phase 6 (video
continuation/interpolation). Wire options that were accepted but ignored, add
multi-speaker dialogue support, and expose the complete Gemini voice catalog.

**Observable proof:**
1. **Options plumbing:** Trigger a `generate_speech` task with
   `options: { "voice": "Charon" }`. Verify the REST payload uses `voiceConfig`
   with `voiceName: "Charon"` instead of the default `"Kore"`.
2. **Multi-speaker:** Trigger a `generate_speech` task with
   `options: { "speaker_1": "Host:Aoede", "speaker_2": "Guest:Puck" }` and a
   transcript using `"Alias: text"` format. Verify the REST payload uses
   `multiSpeakerVoiceConfig` with correct alias/voice mappings.
3. **Voice catalog:** Verify `tasks_list_types` returns all 30 Gemini prebuilt
   voices with personality annotations in the `voice` enum.

### Changes

- [x] **[MODIFY]
      [speech.py](packages/bees/bees/runners/adapters/speech.py)**
  - Wire `options.voice` to override the segment-derived voice preset.
  - Add multi-speaker support: when `speaker_1` and `speaker_2` options are
    present (flat `"Alias:VoiceName"` strings), switch the REST payload from
    `voiceConfig` to `multiSpeakerVoiceConfig`. Flat strings avoid LLM
    serialization failures with nested objects.
  - Extract voice resolution and speech config building into `_resolve_voice`
    and `_build_speech_config` helpers for testability.
- [x] **[MODIFY]
      [TEMPLATES.yaml](hives/chat-app/config/TEMPLATES.yaml)**
  - Expand `voice` enum to all 30 Gemini prebuilt voices with personality
    annotations in the description.
  - Remove phantom `speech_speed` option (not a real API parameter — pacing
    is controlled via natural language audio tags).
  - Add `speaker_1` and `speaker_2` options (string type, `"Alias:VoiceName"`
    format) for multi-speaker dialogue. Flat strings prevent LLM tool-calling
    serialization failures with nested objects.
  - Enrich template description with audio tag guidance and multi-speaker
    usage patterns.
  - Add `test_multi_speaker_speech` test harness template.

#### Verification

- [x] Add automated tests verifying options.voice override, options.voice
      precedence over segment voice, and multi-speaker `multiSpeakerVoiceConfig`
      payload shape in `test_direct_model_speech.py`.
- [x] Run `test_multi_speaker_speech` template end-to-end and verify the
      generated audio contains two distinct voices.

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
      direct_model.py            ← DirectModelRunner and DirectModelStream (SessionRunner protocols)
      adapters/
        protocol.py              ← GenAdapter protocol interface
        text.py                  ← Text generation adapter via Gemini Stream
        image.py                 ← Image generation adapter via Gemini REST
        video.py                 ← Video generation adapter via Veo REST
        speech.py                ← Speech generation adapter via Gemini REST
        music.py                 ← Music generation adapter via Gemini REST
    functions/
      tasks.py                   ← ensure child slug parameters are wired

  tests/
    test_runners/
      test_direct_model_text.py    ← verify text adapter execution and thoughts
      test_direct_model_image.py   ← verify image adapter execution and PNG outputs
      test_direct_model_music.py   ← verify music adapter execution and WAV outputs
      test_direct_model_speech.py  ← verify speech adapter execution and WAV outputs
      test_direct_model_video.py   ← verify video adapter execution and MP4 outputs
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
