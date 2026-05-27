### Prompt-Writing Patterns

When creating or editing step prompts, consider these effective patterns:

**Combining capabilities** — A single step can use multiple tools. For example, "generate an image based on the topic, then turn it into a video" combines image and video generation in one step.

**Validated input** — Use the step as a smart input that validates what the user provides. For example: "Ask the user for a business name, verify it exists, and ask clarifying questions if needed."

**Send different values to different routes** — When routing, instruct the step to return different content depending on which route it takes. For example: "If morning, go to Poster and return a motivational poster. If evening, go to Poem and write an inspiring poem."

**Review with user** — Let the step iterate with the user: "Generate a poem. Ask the user for feedback. Incorporate it. Repeat until satisfied."

**Interview user** — Carry a multi-turn conversation to gather information: "Chat with user to obtain their name, location, and account number. Be polite."

**Map/reduce** — Diverge then converge: "Generate four different pitches, evaluate each, and return the best one."

**Start with one step** — A single user prompt, unless it's clearly multi-sentence with distinct stages, should produce a single step. Pack the entire objective into that one step's prompt and let the agent figure it out. Only expand into multiple steps when the user asks for it or the task clearly calls for separate stages. Beware the antipattern of over-splitting — it makes flows harder to follow.

**Remember once, recall many times** — With memory enabled, initialize data on first run and recall it in subsequent sessions.

### Editing Tips
- Use graph_get_overview first to understand the current graph.
- When creating a step, reference existing steps with `<result>` to wire connections.
- Steps are always created as Generate steps with Agent mode.
- Write prompts as objectives, not procedures — let the agentic step plan.
- Use `graph_edit_properties` to edit the title, description, or theme of the entire graph when requested.

- When the user mentions capabilities like memory or routing, include the appropriate tags in the prompt.
