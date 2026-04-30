---
name: surface
title: Presenting Your Work via Surface
description:
  Learn how to present your work as a structured surface — a curated manifest of
  artifacts that the user's application renders in real time.
allowed-tools:
  - files.*
  - events.*
---

# What is a Surface?

A **surface** is a structured manifest that tells the user's application what to
display. It contains links to various files to present to the user and
optionally, groups them into sections.

A surface is a living document you update as you work, so the user sees your
progress in real time.

# The Workflow

Every time you produce, update, or receive a meaningful artifact, follow these
steps:

1. **Write `surface.json`.** Overwrite it with the complete current state of
   what you want to present, including the new/updated artifact. Increment the
   `version` counter.
2. **Broadcast.** Call `events_broadcast` with type `surface_updated`. The
   consumer application listens for `surface_updated` and re-reads
   `surface.json` to update the display.

# Format

`surface.json` is a single JSON file that you overwrite on every change.

```json
{
  "version": 1,
  "title": "My Surface Title",
  "sections": [{ "id": "main", "title": "Main Results" }],
  "items": [
    {
      "id": "findings",
      "title": "Research Findings",
      "path": "research_notes.md",
      "description": "Key findings from the analysis",
      "section": "main"
    }
  ]
}
```

## Top-level fields

| Field      | Required | Description                                             |
| ---------- | -------- | ------------------------------------------------------- |
| `version`  | **yes**  | Integer. Start at 1, increment on every write.          |
| `title`    | no       | Human-readable name for the surface.                    |
| `sections` | no       | Declared section groups. Omit if no grouping is needed. |
| `items`    | **yes**  | Ordered list of content items.                          |

## Sections

Sections are optional named groups. Items reference them by `id`.

| Field         | Required | Description                             |
| ------------- | -------- | --------------------------------------- |
| `id`          | **yes**  | Stable identifier, referenced by items. |
| `title`       | **yes**  | Human-readable heading.                 |
| `description` | no       | Brief description of the section.       |

## Items

Each item represents one piece of content you want to present.

| Field         | Required | Description                                                                                                      |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`          | **yes**  | Stable identifier, unique within the surface.                                                                    |
| `title`       | **yes**  | Human-readable label.                                                                                            |
| `path`        | no       | File path (workspace-relative). At least one of `path` or `description` must be present.                         |
| `description` | no       | Inline text — standalone content, preview, or metadata. At least one of `path` or `description` must be present. |
| `render`      | no       | Rendering override. Use `bundle` for JS files that should render in a sandboxed iframe.                          |
| `role`        | no       | Semantic role: `primary` (hero), `supporting` (detail), `status` (lightweight indicator).                        |
| `section`     | no       | The section `id` this item belongs to. Ungrouped items go to a default section.                                  |

# Rules

## Paths match `files_write_file`

The `path` field in items uses the same workspace-relative format as
`files_write_file`. If you write a file with `files_write_file` using
`research/findings.md`, reference it in the surface as
`"path": "research/findings.md"`.

## Write `surface.json` in your writable directory

Use `files_write_file` with `"file_name": "surface.json"`. If you are a
sub-agent with a scope restriction, write it within your assigned directory
(e.g., `research/surface.json`). The consumer discovers surface files by walking
the filesystem tree.

## The surface is complete state, not a diff

Every time you write `surface.json`, include **all** items you want displayed —
not just the ones that changed. If you previously had 3 items and now have 4,
write all 4. If you want to remove an item, omit it from the next write.

## Increment version on every write

The `version` counter lets the consumer detect changes. Start at 1. Increment by
1 on every write, even if only the ordering changed.

## Always broadcast after writing

After writing `surface.json`, call `events_broadcast` with:

- `type`: `surface_updated`
- `message`: brief description of what changed (e.g., "Added research findings")

## Items without files are valid

Not every item needs a file. Use `description` alone for lightweight status
indicators:

```json
{
  "id": "status",
  "title": "Progress",
  "description": "3 of 5 sources analyzed",
  "role": "status"
}
```

## Bundles use a render hint

If you produce a JavaScript bundle (e.g., an interactive chart), set
`"render": "bundle"` on the item. The consumer loads the JS in a sandboxed
iframe and discovers a companion CSS file by convention (same filename stem).

## Update the surface incrementally as you work

Don't wait until the end. The surface is most valuable when the user can see
progress. A good pattern:

1. Write an initial surface with a status item: "Starting analysis..."
2. As you produce content files, add them to the surface.
3. Update status items to reflect progress.
4. When done, write the final surface with all artifacts and remove status
   items.

# Example: Research Agent with Surface

A research agent doing competitive analysis might produce this sequence:

**After starting (version 1):**

```json
{
  "version": 1,
  "items": [
    {
      "id": "status",
      "title": "Status",
      "description": "Researching competitors — 3 searches in progress",
      "role": "status"
    }
  ]
}
```

**After first results (version 2):**

```json
{
  "version": 2,
  "title": "Competitive Analysis",
  "sections": [{ "id": "findings", "title": "Findings" }],
  "items": [
    {
      "id": "market-overview",
      "title": "Market Overview",
      "path": "research/market_overview.md",
      "description": "Current market landscape and key players",
      "role": "primary",
      "section": "findings"
    },
    {
      "id": "status",
      "title": "Status",
      "description": "2 of 3 research threads complete",
      "role": "status"
    }
  ]
}
```

**Final surface (version 3):**

```json
{
  "version": 3,
  "title": "Competitive Analysis",
  "sections": [
    { "id": "findings", "title": "Findings" },
    { "id": "data", "title": "Supporting Data" }
  ],
  "items": [
    {
      "id": "market-overview",
      "title": "Market Overview",
      "path": "research/market_overview.md",
      "description": "Current market landscape and key players",
      "role": "primary",
      "section": "findings"
    },
    {
      "id": "competitor-matrix",
      "title": "Competitor Comparison",
      "path": "research/competitor_matrix.md",
      "description": "Feature-by-feature comparison of top 5 competitors",
      "section": "findings"
    },
    {
      "id": "raw-data",
      "title": "Research Data",
      "path": "research/raw_data.json",
      "description": "Structured data from all sources",
      "role": "supporting",
      "section": "data"
    }
  ]
}
```

Each version was followed by an `events_broadcast` with type `surface_updated`.
