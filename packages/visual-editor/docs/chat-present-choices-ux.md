# Chat Present Choices UX Reference

This document describes all possible UX permutations for the
`chat_present_choices` agent function. Use this as a reference when designing UI
states for the choice presentation system.

---

## Overview

The `chat_present_choices` function allows the AI agent to present users with a
set of options. The UX varies based on two key dimensions:

| Dimension          | Options               | Description                          |
| ------------------ | --------------------- | ------------------------------------ |
| **Selection Mode** | `single`, `multiple`  | How many choices the user can select |
| **Layout**         | `list`, `row`, `grid` | How choices are visually arranged    |

This creates **6 core UX states** (2 selection modes × 3 layouts).

---

## Selection Modes

### Single Selection (`selection_mode: "single"`)

- **Component**: Buttons
- **Interaction**: User clicks one button, selection is immediately submitted
- **No submit button required** — clicking a choice is the action
- **Returns**: Exactly one selected choice ID

### Multiple Selection (`selection_mode: "multiple"`)

- **Component**: Checkboxes
- **Interaction**: User toggles any number of checkboxes, then clicks "Submit"
- **Submit button is always present** at the bottom
- **Returns**: Array of selected choice IDs (can be empty)

---

## Layout Options

### List Layout (`layout: "list"` — Default)

```
┌─────────────────────────────────┐
│  [Message text here]            │
│                                 │
│  ┌───────────────────────────┐  │
│  │       Choice A            │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │       Choice B            │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │       Choice C            │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

- **Arrangement**: Vertical stack (Column)
- **Best for**: Longer choice labels, detailed descriptions
- **Alignment**: Choices stretch to full width

### Row Layout (`layout: "row"`)

```
┌─────────────────────────────────────────────┐
│         [Message text here]                 │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Choice A │  │ Choice B │  │ Choice C │   │
│  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────┘
```

- **Arrangement**: Horizontal inline (Row)
- **Best for**: Short labels like "Yes / No", binary decisions, side-by-side
  comparisons
- **Alignment**: Center-aligned for simple content; stretch for complex content

### Grid Layout (`layout: "grid"`)

```
┌─────────────────────────────────────────────┐
│         [Message text here]                 │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Choice A │  │ Choice B │  │ Choice C │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐                 │
│  │ Choice D │  │ Choice E │                 │
│  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────┘
```

- **Arrangement**: Wrapping grid that adapts to available space
- **Best for**: Many options that would overwhelm a vertical list
- **Note**: Current implementation uses Row semantics; future may add flex-wrap

---

## The 6 Core UX States

### 1. Single + List

```
┌─────────────────────────────────┐
│  Which color do you prefer?     │
│                                 │
│  ┌───────────────────────────┐  │
│  │         🔴 Red            │  │ ← Button
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │        🟢 Green           │  │ ← Button
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │         🔵 Blue           │  │ ← Button
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Use case**: Selecting from a small set of detailed options.

---

### 2. Single + Row

```
┌─────────────────────────────────────────┐
│      Do you want to proceed?            │
│                                         │
│     ┌───────┐          ┌────────┐       │
│     │  Yes  │          │   No   │       │
│     └───────┘          └────────┘       │
└─────────────────────────────────────────┘
```

**Use case**: Binary decisions, quick yes/no confirmations.

---

### 3. Single + Grid

```
┌─────────────────────────────────────────────┐
│       Select your preferred icon:           │
│                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐         │
│  │   🏠   │  │   🚗   │  │   ✈️   │         │
│  └────────┘  └────────┘  └────────┘         │
│  ┌────────┐  ┌────────┐                     │
│  │   🎵   │  │   📷   │                     │
│  └────────┘  └────────┘                     │
└─────────────────────────────────────────────┘
```

**Use case**: Icon or image selection, visual browsing.

---

### 4. Multiple + List

```
┌─────────────────────────────────┐
│  Select your dietary needs:     │
│                                 │
│  ☐ Vegetarian                   │
│  ☐ Vegan                        │
│  ☐ Gluten-free                  │
│  ☐ Dairy-free                   │
│                                 │
│       ┌──────────────┐          │
│       │    Submit    │          │
│       └──────────────┘          │
└─────────────────────────────────┘
```

**Use case**: Multi-select from a list of preferences or filters.

---

### 5. Multiple + Row

```
┌─────────────────────────────────────────────────────┐
│       Which days work for you?                      │
│                                                     │
│   ☐ Mon    ☐ Tue    ☐ Wed    ☐ Thu    ☐ Fri        │
│                                                     │
│              ┌──────────────┐                       │
│              │    Submit    │                       │
│              └──────────────┘                       │
└─────────────────────────────────────────────────────┘
```

**Use case**: Quick multi-select from short labels.

---

### 6. Multiple + Grid

```
┌─────────────────────────────────────────────────────┐
│        Select the photos you want to keep:          │
│                                                     │
│   ☐ Photo 1    ☐ Photo 2    ☐ Photo 3              │
│   ☐ Photo 4    ☐ Photo 5    ☐ Photo 6              │
│                                                     │
│              ┌──────────────┐                       │
│              │    Submit    │                       │
│              └──────────────┘                       │
└─────────────────────────────────────────────────────┘
```

**Use case**: Gallery selection, bulk item management.

---

## Rich Content in Choices

Choice labels support **rich content** via "pidgin" format, which can include:

- **Images**: `<file src="/vfs/image.png" />`
- **Text**: Plain text content
- **Mixed**: Combination of images and text

### Example: Image + Text Choice (Single + Row)

```
┌─────────────────────────────────────────────────────────┐
│         Which design do you prefer?                     │
│                                                         │
│  ┌──────────────────────┐    ┌──────────────────────┐   │
│  │     ┌──────────┐     │    │     ┌──────────┐     │   │
│  │     │  Image A │     │    │     │  Image B │     │   │
│  │     └──────────┘     │    │     └──────────┘     │   │
│  │    "Modern Theme"    │    │   "Classic Theme"    │   │
│  └──────────────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

When choices contain complex content (multi-part, such as image + text):

- Buttons are given **equal weight** for uniform sizing
- Content stacks vertically within each button (Column layout)
- **Stretch alignment** is applied for visual consistency

---

## Message Area

The **message** parameter appears above the choices and also supports rich
content:

- Can reference VFS files: `<file src="/vfs/chart.png" />`
- Multiple content parts are stacked vertically in a container
- Centered within the root layout

---

## Layout Behavior Summary

| Layout | Container | Alignment (Simple) | Alignment (Complex) | Best For             |
| ------ | --------- | ------------------ | ------------------- | -------------------- |
| `list` | Column    | stretch            | stretch             | Detailed options     |
| `row`  | Row       | center             | stretch             | Binary/short choices |
| `grid` | Row       | start              | stretch             | Many visual options  |

---

## Design Considerations

1. **Single vs Multiple Visual Distinction**
   - Single: Buttons (immediate action)
   - Multiple: Checkboxes + Submit button (deferred action)

2. **Layout Selection by Agent**
   - Agent chooses layout based on content type
   - Short labels → `row`
   - Long descriptions → `list`
   - Visual items (images) → `row` or `grid`

3. **Root Container**
   - All content is wrapped in a centered Column
   - Vertically and horizontally centered within the surface

4. **Consistent Component IDs**
   - Message: `message-*` prefix
   - Choice content: `choice-content-{index}`
   - Buttons: `choice-btn-{index}`
   - Checkboxes: `choice-checkbox-{index}`
   - Containers: `choices-container`, `message-container`

---

## Input Parameters Reference

| Parameter         | Type   | Required | Default  | Description                                               |
| ----------------- | ------ | -------- | -------- | --------------------------------------------------------- |
| `user_message`    | string | ✓        | —        | Message explaining what to choose; supports `<file>` tags |
| `choices`         | array  | ✓        | —        | Array of `{id, label}` objects                            |
| `choices[].id`    | string | ✓        | —        | Unique identifier returned on selection                   |
| `choices[].label` | string | ✓        | —        | Display text; supports `<file>` tags                      |
| `selection_mode`  | enum   | ✓        | —        | `"single"` or `"multiple"`                                |
| `layout`          | enum   |          | `"list"` | `"list"`, `"row"`, or `"grid"`                            |

---

## Response Format

```typescript
{
  selected: string[]  // Array of choice IDs
}
```

- **Single mode**: Always returns exactly 1 element
- **Multiple mode**: Returns 0 or more elements
