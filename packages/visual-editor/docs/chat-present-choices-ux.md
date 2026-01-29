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

This creates **6 core UX states** (2 selection modes × 3 layouts), with an
optional **"None of the Above"** escape hatch.

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

Choice labels support **rich content** via pidgin format. Each choice label can
contain multiple parts that are converted to UI components.

### Supported Content Types

| Type            | UI Component                |
| --------------- | --------------------------- |
| **Text**        | Text block                  |
| **Images**      | Image viewer                |
| **Videos**      | Video player                |
| **Audio**       | Audio player                |
| **PDFs**        | PDF viewer                  |
| **Drive Files** | Embedded Docs/Sheets/Slides |

### Layout Behavior

- **Single-part content** (text only): Wrapped in a **Row** container
- **Multi-part content** (e.g., image + text): Wrapped in a **Column** container
  - Content stacks vertically
  - Center-aligned horizontally
  - Distribution starts from top

When any choice has complex content:

- Buttons are given **equal weight** for uniform sizing
- **Stretch alignment** is applied to the choices container

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

---

## Message Area

The **user_message** parameter appears above the choices and supports the same
rich content types as choice labels.

### Supported Content Types

Same as choice labels: Text, Images, Videos, Audio, PDFs, and Drive Files.

### Layout Behavior

- **Single-part message**: Added directly to top-level layout
- **Multi-part message**: Wrapped in a **Column** container
  (`message-container`)
  - Parts stack vertically
  - Container stretches to fit content

### Example: Message with Embedded Image

```
┌─────────────────────────────────────────────────────────┐
│   Here are the results of your analysis:                │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │                                                 │   │
│   │              [Generated Chart]                  │   │
│   │                                                 │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
│   Which category would you like to explore?             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    Category A                     │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    Category B                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

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

---

## "None of the Above" Option

The optional `none_of_the_above_label` parameter adds an escape hatch for users
to reject all presented choices.

### Visual Treatment

```
┌─────────────────────────────────┐
│  Which option do you prefer?    │
│                                 │
│  ┌───────────────────────────┐  │
│  │       Option A            │  │ ← Primary button
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │       Option B            │  │ ← Primary button
│  └───────────────────────────┘  │
│  ─────────────────────────────  │ ← Divider
│  ┌───────────────────────────┐  │
│  │        Exit               │  │ ← Secondary button
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Behavior

| Selection Mode | Component        | Behavior                                                         |
| -------------- | ---------------- | ---------------------------------------------------------------- |
| `single`       | Secondary button | Clicking returns `["__none_of_the_above__"]` immediately         |
| `multiple`     | Checkbox         | Works like any other checkbox; included in selections if checked |

### Design Guidelines

1. **Visual Distinction**: Always rendered below a divider with secondary button
   styling
2. **Single Mode Recommended**: Best suited for single selection; in multiple
   mode it behaves as a regular checkbox
3. **Common Labels**: "Exit", "Skip", "Try Again", "None apply", "Go back"
