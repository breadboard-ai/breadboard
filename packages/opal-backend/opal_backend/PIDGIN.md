# Agent Pidgin

**Pidgin** is a lightweight, XML-like markup language used to communicate
structured intent to the Gemini-powered agent loop. It acts as the bridge
between the client's typed segment model (assets, inputs, tools) and the
flat text context that the LLM consumes.

The single authoritative implementation lives in `pidgin.py`.

---

## Purpose

The agent loop operates on plain text. But a user's objective can contain
rich structure: inline images, file attachments, tool references, and
multi-part assets. Pidgin gives the LLM a vocabulary to *reference* those
objects without embedding raw binary data in the prompt. Two directions:

| Direction | Function | What it does |
|:--|:--|:--|
| **Structured → Text** | `to_pidgin` | Converts wire-protocol segments into pidgin text for the LLM. Registers binary parts in `AgentFileSystem`. |
| **Text → Structured** | `from_pidgin_string` | Parses pidgin tags in LLM output back into `LLMContent` parts. Resolves `<file>` references via `AgentFileSystem`. |

---

## Tag Reference

### `<asset>`

Wraps a named block of content (text and/or files) provided as context to
the agent.

```xml
<asset title="Design Spec">
  <content src="/mnt/file-0001">
    Full text of the spec inlined here…
  </content>
  <file src="/mnt/file-0002" />
</asset>
```

- **`title`** — human-readable label for the asset.
- Nested content is produced by `content_to_pidgin_string`, which handles
  the text/binary split described below.

### `<input>`

Marks content that originated from a previous agent turn (another agent's
output being fed as input to the current agent).

```xml
<input source-agent="Researcher">
  Summary text here…
  <file src="/mnt/file-0003" />
</input>
```

- **`source-agent`** — name of the agent that produced the content.
- Internal structure follows the same rules as `<asset>`.

### `<file>`

A self-closing tag that references a binary part (image, PDF, etc.)
registered in the `AgentFileSystem`.

```xml
<file src="/mnt/file-0001" />
```

- **`src`** — the `/mnt/…` path returned by `AgentFileSystem.add_part`.
- Used both inside containers (`<asset>`, `<input>`) and standalone in LLM
  output.

### `<content>`

Wraps a large text part that has been stored as a file but whose text is
*also* inlined for the LLM to read directly. Applied when a text part
exceeds `MAX_INLINE_CHARACTER_LENGTH` (1 000 characters).

```xml
<content src="/mnt/file-0004">
  The full text of the document, inlined…
</content>
```

- **`src`** — file-system path, so the agent can reference the same content
  by path later.
- Text parts ≤ 1 000 characters are inlined as bare text (no tag).

### `<a>`

An anchor tag representing a routing choice. Produced when a `tool` segment
with the routing path is encountered.

```xml
<a href="route-0">Customer Support</a>
```

- **`href`** — route identifier returned by `AgentFileSystem.add_route`.
- Body — the human-readable label for the route.

---

## Segment-to-Pidgin Mapping

`to_pidgin` walks a list of wire-protocol segments and emits pidgin text.
Each segment is first normalized from proto-style oneof format
(`{"textSegment": {…}}`) to flat format (`{"type": "text", …}`).

| Segment Type | Pidgin Output | Side Effects |
|:--|:--|:--|
| `text` | Bare text, appended as-is | — |
| `asset` | `<asset title="…">…</asset>` | Binary/large-text parts registered in `AgentFileSystem` |
| `input` | `<input source-agent="…">…</input>` | Same as `asset` |
| `tool` (routing) | `<a href="…">title</a>` | Route registered in `AgentFileSystem` |
| `tool` (memory) | `"Use Memory"` literal | Sets `use_memory` flag |
| `tool` (NotebookLM) | `"Use NotebookLM"` literal | Sets `use_notebooklm` flag |
| `tool` (custom) | *(no text emitted)* | URL recorded in `custom_tool_urls` |

---

## Pidgin-to-Parts Resolution

`from_pidgin_string` parses pidgin markup in agent output and resolves
references back to structured data:

1. **Split** the string on `<file … />` and `<a …>…</a>` tags.
2. **`<file>`** tags → resolved via `AgentFileSystem.get(path)`, producing
   binary `LLMContent` parts.
3. **`<a>`** tags → the title text is extracted as a plain text part.
4. **Plain text** segments → kept as text parts.
5. **Merge** consecutive text parts into one (using newline separator).

The result is an `LLMContent` dict (`{"parts": […], "role": "user"}`).

---

## Helper: `content_to_pidgin_string`

Converts an `LLMContent` dict (with `parts` array) into pidgin text.
Used internally by `to_pidgin` for `asset` and `input` segments, and also
as a public API for converting function outputs.

**Rules per part:**

| Part type | Condition | Output |
|:--|:--|:--|
| Text | ≤ 1 000 chars | Bare text |
| Text | > 1 000 chars (with `text_as_files=True`) | `<content src="…">text</content>` |
| NotebookLM URL | `storedData.handle` starts with NotebookLM prefix | URL as bare text |
| Binary (image, file, etc.) | — | `<file src="…" />` |

---

## Design Invariants

- **Single vocabulary definition.** All pidgin tags are defined exclusively
  in `pidgin.py`. No other module in the Python backend should emit or
  parse pidgin markup.
- **File-system coupling.** Every `<file>` and `<content>` tag corresponds
  to a registered entry in `AgentFileSystem`. The file system instance used
  during `to_pidgin` must be the same one the agent loop uses — otherwise
  references break.
- **Round-trip fidelity.** A `<file>` tag emitted by `to_pidgin` or
  `content_to_pidgin_string` can be resolved back by `from_pidgin_string`
  against the same file system.
