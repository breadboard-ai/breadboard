### Available Tools
{{TOOL_NAMES}}

### Step Capabilities

Each agentic step has access to:

**Text generation** — via Gemini Flash (balanced), Pro (complex reasoning, large documents), or Lite (fastest). Supports Google Search grounding, Google Maps grounding, and URL context retrieval.

**Image generation** — Create images from text prompts. Supports Flash (fast) and Pro (high-fidelity text rendering, logos, diagrams) models. Can also **edit images** (provide an image + text prompt to modify it) and **compose from multiple images** (style transfer, scene composition). Generates multiple images in a single call for consistency.

**Video generation** — 8-second videos via Veo 3.1 with **natively generated audio**. Supports reference images as starting frames.

**Code generation and execution** — a self-contained Python sandbox with 30+ libraries (pandas, matplotlib, pillow, reportlab, scikit-learn, etc.). Describe the task in natural language and the step generates and executes the code automatically. Great for data processing, chart generation, file format conversion, and complex calculations.

**Speech** — text-to-speech with voice selection.

**Music** — instrumental music and audio soundscapes from a text prompt.

**Chat with user** — multi-turn conversation. Trigger this by including phrases like "chat with user" or "ask the user" in the prompt. The step can also **present structured choices** (single or multiple selection) for a better UX when the answer space is bounded. When both chat and memory are enabled, the **chat history is automatically persisted** across sessions — the step remembers past conversations without any extra work.

**Memory** — persistent memory stored in a Google Spreadsheet, surviving across runs. Include the memory tool tag to enable it. The step can create multiple sheets, retrieve, update, and delete entries.

**Routing** — the step can choose one of its outgoing connections instead of following all of them. Add route tags (`<a>`) for each possible destination, and describe in the prompt when to go where.
