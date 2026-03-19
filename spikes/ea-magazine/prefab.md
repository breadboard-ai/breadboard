---
name: Prefab Component Library
description:
  Generic UI primitives the model should use by default in prefab mode.
  Only branch out from these when there's a clear justification.
---

# Prefab Component Library

In **prefab mode**, you have a library of generic UI primitives available via
`require("@prefab/ComponentName")`. You MUST use these components by default
wherever they fit. If you need to create a custom component instead, you must
include a brief JSDoc comment explaining why the built-in wasn't sufficient.

## Available Components

All components accept standard React props. Use the `--cg-` design tokens for
any style customization.

### Layout

```jsx
const Column = require("@prefab/Column").default;
const Row = require("@prefab/Row").default;
```

- **Column**: Vertical flex container. Props: `gap`, `align`, `justify`, `style`
- **Row**: Horizontal flex container. Props: `gap`, `align`, `justify`, `wrap`, `style`

### Content

```jsx
const Card = require("@prefab/Card").default;
const Image = require("@prefab/Image").default;
const Icon = require("@prefab/Icon").default;
const Chip = require("@prefab/Chip").default;
```

- **Card**: Surface container with elevation. Props: `elevation` (1-3), `padding`, `radius`, `style`, `onClick`
- **Image**: Responsive image with loading state. Props: `src`, `alt`, `aspectRatio`, `radius`, `style`
- **Icon**: Material Symbols wrapper. Props: `name`, `size`, `color`, `filled`, `style`
- **Chip**: Small badge/tag. Props: `label`, `color`, `variant` ("filled"|"outlined"), `icon`, `style`

### Interactive

```jsx
const Button = require("@prefab/Button").default;
const Checkbox = require("@prefab/Checkbox").default;
const Input = require("@prefab/Input").default;
const TextField = require("@prefab/TextField").default;
const Switch = require("@prefab/Switch").default;
const Slider = require("@prefab/Slider").default;
const RadioButton = require("@prefab/RadioButton").default;
```

- **Button**: Props: `variant` ("filled"|"outlined"|"text"), `icon`, `label`, `onClick`, `disabled`, `style`
- **Checkbox**: Props: `checked`, `onChange`, `label`, `style`
- **Input**: Single-line input. Props: `value`, `onChange`, `placeholder`, `type`, `style`
- **TextField**: Multi-line input. Props: `value`, `onChange`, `placeholder`, `rows`, `style`
- **Switch**: Toggle. Props: `checked`, `onChange`, `label`, `style`
- **Slider**: Range input. Props: `value`, `onChange`, `min`, `max`, `step`, `style`
- **RadioButton**: Props: `checked`, `onChange`, `label`, `name`, `value`, `style`

### Navigation & Feedback

```jsx
const Tabs = require("@prefab/Tabs").default;
const Menu = require("@prefab/Menu").default;
const MenuItem = require("@prefab/MenuItem").default;
const Dialog = require("@prefab/Dialog").default;
```

- **Tabs**: Props: `tabs` (array of `{label, value}`), `activeTab`, `onChange`, `style`
- **Menu**: Dropdown container. Props: `open`, `onClose`, `anchorEl`, `style`
- **MenuItem**: Props: `label`, `icon`, `onClick`, `style`
- **Dialog**: Modal overlay. Props: `open`, `onClose`, `title`, `style`, `children`

### Media

```jsx
const Video = require("@prefab/Video").default;
```

- **Video**: Props: `src`, `poster`, `autoPlay`, `loop`, `muted`, `style`

## Usage Rules

1. **Always try the built-in first.** If a Card can do it, use Card.
2. **Compose, don't replace.** Build complex UI by composing primitives:
   a PlaybookCard is a `Card` containing `Row`, `Column`, `Image`, `Chip`, etc.
3. **Justify custom components.** If you create something not in this list,
   add a JSDoc comment: `/** Custom: Card + progress bar needs integrated
   layout that Card alone can't express */`
4. **Style via tokens.** Pass `style` props using `--cg-` design tokens.
