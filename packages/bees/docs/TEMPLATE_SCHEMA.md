# Template Schema Reference

Templates are the unit of work in the Bees framework. Each entry in
`hive/config/TEMPLATES.yaml` defines a single agent ticket. When a template is
"run", the engine creates a ticket from it: an objective for an agent to
fulfill, persisted as a directory on disk.

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | **yes** | Logical identifier. Used as `playbook_id` on tickets and for delegation via `tasks_create_task`. Must be unique across all templates. |
| `title` | string | no | Human-readable title shown in UI and task type listings. |
| `description` | string | no | Short summary shown in task type listings. |
| `objective` | string | no | The agent's instructions (natural-language prompt). Supports `{{system.context}}` and `{{system.ticket_id}}` interpolation. |
| `functions` | string[] | no | Function filter globs controlling which tools the agent can use. Empty/omitted = all functions available. Examples: `"simple-files.*"`, `"tasks.*"`, `"system.*"`. |
| `skills` | string[] | no | Names of skill directories to load into the session. Each name must match a subdirectory of `hive/skills/`. |
| `tags` | string[] | no | Metadata tags for UI routing, lifecycle hooks, and filtering. Special tags: `"chat"` enables persistent chat history; `"bundle"` marks templates that produce bundled output. |
| `model` | string | no | Override the default model (e.g., `"gemini-3.1-pro-preview"`). |
| `watch_events` | object[] | no | Subscribe to inter-agent coordination events. Each entry has a `type` field (e.g., `{type: "digest_ready"}`). |
| `tasks` | string[] | no | Allowlist of template names this agent can delegate to via `tasks_create_task`. |
| `autostart` | string[] | no | Template names to stamp as child tickets automatically when this template is run. Each entry creates a subagent ticket linked to the parent. |

## Interpolation

Template objectives support placeholder interpolation:

- **`{{system.context}}`** — replaced with the context string passed when the
  ticket is created (typically the parent agent's delegation instructions).
- **`{{system.ticket_id}}`** — replaced with the created ticket's UUID.

## Function Globs

The `functions` field uses glob patterns to filter which tools are available:

- `"simple-files.*"` — all functions in the `simple-files` group.
- `"system.*"` — all system functions (terminate, context access).
- `"tasks.*"` — task delegation functions.
- `"chat.*"` — chat functions (request user input, await context updates).
- `"events.*"` — event broadcasting.
- `"sandbox.*"` — sandboxed code execution.
- `"generate.text"` — a single specific function.

Omitting `functions` entirely grants access to all available functions.

## Example

```yaml
- name: researcher
  title: Researcher
  description: Deeply researches a given topic
  objective: >
    Your job is to deeply research the following topic:

    {{system.context}}

    Compile relevant, accurate information. Save your findings to a file
    called research-data.json or research-notes.md.

    Return the relative path of the file with research.
  functions: ["system.*", "sandbox.*", "simple-files.*", "generate.text"]
```
