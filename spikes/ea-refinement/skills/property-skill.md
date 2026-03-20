---
name: Property Finder
description:
  Art direction for presenting property listings. Defines available widgets,
  the context-proportional presentation model, and image path conventions.
  Technical infrastructure and visual anti-patterns come from the UI Skill.
---

# Property Finder Skill

Present property listings as a curated, opinionated selection — not a
database dump. The depth and richness of your output must be **proportional
to the personal context provided**.

## Available Widgets

Pre-built React components via `require("@widgets/...")`. They are real,
working implementations — **do not reimplement them**.

### Map

```js
const Map = require("@widgets/Map").default;
```

| Prop      | Type                         | Description            |
|-----------|------------------------------|------------------------|
| `center`  | `[lat, lng]`                 | Map center coordinates |
| `markers` | `{ lat, lng, label? }[]`     | Pins to display        |
| `zoom`    | `number` (default: 13)       | Initial zoom level     |
| `height`  | `string` (default: `"200px"`)| CSS height             |

Never place at the top of the page. One map per page, modest height.

### ScoreBar

```js
const ScoreBar = require("@widgets/ScoreBar").default;
```

| Prop        | Type      | Description                    |
|-------------|-----------|--------------------------------|
| `value`     | `number`  | Current score                  |
| `max`       | `number` (default: 10) | Maximum score       |
| `label`     | `string`  | Label text (e.g. "Safety")     |
| `showValue` | `boolean` (default: true) | Show numeric value|

### StarRating

```js
const StarRating = require("@widgets/StarRating").default;
```

| Prop     | Type     | Description                     |
|----------|----------|---------------------------------|
| `rating` | `number` | Rating value (supports halves)  |
| `max`    | `number` (default: 5) | Maximum stars      |
| `size`   | `number` (default: 18) | Star size in pixels|

### Widget Selection

Only use a widget when the user's context gives you a concrete reason to.
No context → no widgets. Rich context → selective widgets that reinforce
what matters most. More context ≠ more widgets.

## Integration Emergence

Components and integrations EMERGE from the intersection of the objective
and personal context. The user does not declare what to include — you
determine it from the context.

- Read the personal context carefully. Every detail matters.
- Infer unstated dimensions only from stated ones.
- Match component depth to context depth.
- Omit what doesn't apply. Every component earns its place.

## Image Paths

The property dataset includes paths like `/images/property-1.png`. These
are real files. Use them as-is in `<img>` tags. Do not use `imageUrl()`
for this dataset — it uses static images, not generated ones.
