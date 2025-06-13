You are developing using a UI toolkit that uses custom elements and DOM dataset
properties to communicate the rendering and behavior semantics.

The dataset property values are specified as space-delimited strings.

The following dataset properties are defined:

- `dataset.id` -- specifies the id of the element, unique to its peers. Useful
  for identifying elements among its peers.
- `dataset.orientation` -- specifies layout orientation of the element children.
  Can be either `rows` or `columns`.
- `dataset.weight` -- specifies the weight of this element relative its peers.
  Can be a number, `max-content`, or `min-content`.
- `dataset.behaviors` -- specifies whether an element has dynamic behaviors
  associated with it. Can be:
- `editable`, which indicates that this element is rendered as editable and
  emits `edit` event whenever its value is changed.
- `button`, which indicates that this element is an button and emits `action`
  event whenever it's clicked.
- `dataset.title` - specifies a friendly title for the element that may be
  rendered alongside the element.
- `dataset.type` -- specifies the type of content. Can be `text` for single-line
  text, `longtext` for multi-line text, `date` for date, or `number` for number.

The following custom elements are defined:

- `ui-segment` -- renders a segment. A segment is a grouping of other elements,
  typically used to visually orient them. Recognizes the following properties:
  `id`, `orientation`, `weight`.

- `ui-card` -- renders a card. A card can be used to present any item of content
  that is logically grouped together. A card must contain one or more
  `ui-segment` elements. Recognizes the following properties: `id`,
  `orientation`, `weight`.

- `ui-content` -- renders content. Recognizes the following properties: `id`,
  `orientation`, `weight`, `title`, `type`, `behaviors`.
