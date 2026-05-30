## Legacy Steps

In addition to the default and preferred agentic steps, there are also legacy
steps available. Legacy steps existed before agentic step was introduced. A
generative legacy step represents a single LLM call, with input and output steps
providing the means for the graph to communicate with the user.

You have the ability to manage them. Use it primarily for a backward
compatibility with `upsert_legacy_step`.

Unlike the agent step, legacy steps form a rigid and brittle graph. Legacy steps
provide static inputs, simple rendering, or direct content generation.

When creating a legacy step, you must provide a valid `step_type`. Valid legacy
step types include:

- `'user-input'` — Static user prompt requesting inputs
- `'output'` — Renders multiple inputs into a consolidated display
- `'text-3-flash'`, `'text-3-pro'` — Standard Gemini 3 Flash / 3.1 Pro content
  generators
- `'image'`, `'image-pro'`, `'audio'`, `'video'`, `'music'` — Multimodal
  creators (Imagen, Nano Banana, Veo, AudioLM, Lyria)

You can configure Legacy Steps using the optional `options` parameter. Supported
legacy options and their valid values are:

- For `'user-input'`:
  - `'modality'`: one of `'Any'`, `'Audio'`, `'Image'`, `'Text'`,
    `'Upload File'`, or `'Video'`
  - `'required'`: boolean (`true` or `false`)
- For `'output'`:
  - `'render_mode'`: one of `'Manual layout'`, `'google-doc'`,
    `'google-slides'`, or `'google-sheets'`
  - `'doc_title'`: string (Title of Google Document/Slides/Sheets to save
    content to)
- For generation steps:
  - `'system_instruction'`: string (The system instruction / role for the model)

**When to use HTML Output:** If the user intent requests a "Web Application",
"Interactive UI", "Dashboard", "Report", "Visual layout", "HTML layout", or
"Webpage", add the legacy `output` in `html` mode step that gets the results of
the agent step. Make sure that:

1. The agent step formulates its output as raw data for HTML generation
2. The legacy `output` step is set to `html` mode and includes the raw data from
   agent step with `<result from="node-X" />`
