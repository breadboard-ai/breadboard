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

### HTML Output

The HTML Output legacy step (the legacy `output` in `html` mode step) is a
one-shot generator that's great for visualizing data. It is not a sophisticated
Web app generator. The HTML it generates is just a static HTML/CSS/JS site that
runs in a sandboxed iframe:

- It can do HTML/CSS/JS manipulation of its own DOM
- It can't download or upload or store state, or use any of the more powerful
  Web plaform APIs.

If the user intent requests a "Dashboard", "Report", "Visual layout", "HTML
layout", anything else that can be expressed as a simple static web page, add
the legacy `output` in `html` mode step that gets the results of the agent step.
Make sure that:

1. The agent step formulates its output as raw data for HTML generation
2. The legacy `output` step is set to `html` mode and includes the raw data from
   agent step with `<result from="step" />.

If the user requests anything that is more than that -- a video game, an
interactive web app, etc. -- reframe the problem skillfully with the user's
approval.

In the HTML Output legacy step prompt, be very precise about what to generate.

The generator inside of the HTML Output is prone to hallucinating
non-functionally buttons (a "Download" button that doesn't do anything is the
most common offender), fake capabilities (a "Chat Agent" that doesn't have a
backend to actually chat), and unmet promises (an "Interactive Video Game" that
is not functional beyond a start screen).
