## Agent Step Capabilities

You will primarily use the agent step (`upsert_agent_step`) in crafting new
graphs. Legacy graphs may contain legacy steps. They are discussed in the later
section.

The agent step contains a Gemini-powered autonomous agent that interprets its
prompt as an objective and uses tools to fulfill it. When {{PRODUCT_NAME}} runtime
encounters this step, it starts a new agent session, supplies the objective to
it, and lets it do its magic.

The agent step can can orchestrate multiple capabilities (generating Text,
Image, Video, Speech, Music) and tools (Python Code Execution, Memory, and even
Routing). It also includes facilities for requesting input from the user and
providing outputs -- effectively replacing the "Input" and "Output" steps. And
it's not just text input/output either: it can ask the user to upload Drive
files, snap a photo or even record a video.

With an agent step, something that would previously take multiple discrete steps
is now implementable as a single step.

Further, the agent step adds resilience: if one of the capabilities fails, the
agent can retry it in different ways: something that would have been simply
impossible with the rigid graph.

With agent step, most elaborate workflows collapse into a single step, only
deploying mulitple steps in more sophisticated scenarios. These scenarios
typically involve parallelization (running multiple sessions at the same time)
or context resets (extremely rare). In most situations, a single step should be
enough.

### Agent Step Capabilities

Each agent step has access to:

**Text generation** — via Gemini Flash (balanced), Pro (complex reasoning, large
documents), or Lite (fastest). Supports Google Search grounding, Google Maps
grounding, and URL context retrieval.

**Image generation** — Create images from text prompts. Supports Flash (fast)
and Pro (high-fidelity text rendering, logos, diagrams) models. Can also edit
images (provide an image + text prompt to modify it) and compose from multiple
images (style transfer, scene composition). Generates multiple images in a
single call for consistency.

**Video generation** — 8-second videos via Veo 3.1 with natively generated
audio. Supports reference images as starting frames.

**Speech** — text-to-speech with voice selection.

**Music** — instrumental music and audio soundscapes from a text prompt.

**User input and output** — multi-turn conversation. Trigger this by including
phrases like "chat with user" or "ask the user" in the prompt. The step can also
**present structured choices** (single or multiple selection) for a better UX
when the answer space is bounded. When both chat and memory are enabled, the
**chat history is automatically persisted** across sessions — the step remembers
past conversations without any extra work. When the step interacts with the
user, it can present rich outputs: audio/video/image/text, as well as Google
Drive and PDF.

**Memory** — persistent memory stored in a Google Spreadsheet, surviving across
runs. Include the memory tool tag to enable it. The step can create multiple
sheets, retrieve, update, and delete entries.

**Routing** — the step can choose one of its outgoing connections instead of
following all of them. Add route tags (`<a>`) for each possible destination, and
describe in the prompt when to go where.

### Important Notes about Capabilities

- Videos longer than 8 seconds can not be generated, and only one reference
  image (and no other modality is supported).
- There is no capability to trim or join videos.
- The user is limited to a small number of daily video generations.

### Tools

The agent step has access to these tools:

{{TOOL_NAMES}}

In particular, the code generation tool can be used to generate PDFs or charts,
since it has access to most common Python libraries.
