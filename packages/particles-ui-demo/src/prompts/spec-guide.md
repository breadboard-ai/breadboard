**Core Concepts**

The UI toolkit revolves around the concept of an "item". Each item has data and
a "presentation" that dictates how the data is displayed. The presentation
defines the type of element used (card or list) and how its content is
structured and laid out.

**1. Orientation**

Orientation defines the direction in which elements are laid out:

- **Horizontal:** Items are arranged in columns, side by side.
- **Vertical:** Items are arranged in rows, one above the other.

**2. Element Type**

The element type determines the overall structure used to display the content:

- **Card:** A container for presenting a distinct piece of information. Use when
  content is logically grouped. Best with horizontal orientation.
- **List:** A collection of items, typically cards, arranged vertically. Best
  with vertical orientation.

**3. Segment Type**

Segments divide a card or list item into meaningful sections. Think of them as
containers _within_ a card or list item.

- **Media:** Best suited for displaying images or large blocks of visual content
- **Block:** Best suited for displaying content which requires no padding.
- **List:** Best for displaying text, numbers, dates, lists, or other non-media
  data.

**4. Behavior**

Behaviors define actions that can be performed on an item or field:

- **Editable:** The user can modify the item's content.
- **Delete:** The user can remove the item.

**5. Modifier**

Modifiers alter the appearance or behavior of an item:

- **Hero:** Emphasizes an item, making it stand out. Only use with images when
  the parent item has a vertical orientation.

**6. Field**

Fields represent individual pieces of data within a segment that need to be
rendered. They contain the following properties:

- **as:** The rendering type of the field
  - **particle-ui-audio:** Represents audio data.
  - **particle-ui-button:** Represents behavioral buttons like "add", "create",
    "delete", "edit".
  - **particle-ui-code:** A piece of code.
  - **particle-ui-date:** A date value.
  - **particle-ui-file:** A downloadable file.
  - **particle-ui-google-drive:** A reference to a Google Drive file.
  - **particle-ui-image:** An image.
  - **particle-ui-number:** A numerical value, e.g., time or distance.
  - **particle-ui-text:** A single line of text, e.g., a title.
  - **particle-ui-long-text:** Multiple lines of text, e.g. a description.
  - **particle-ui-video:**
- **modifiers:** Visual adjustments or enhancements to the field (e.g., "hero").
- **title:** A label for the field.
- **icon:** (For behaviors) An icon to represent the action ("delete", "add",
  "check").

**7. Segment**

A segment is a section within a card or list item. It contains a collection of
fields and has properties that control its layout and appearance.

- **weight:** Determines how much space the segment occupies relative to other
  segments:
  - A number: Specifies a proportional weight (used for horizontal layouts).
    Higher numbers mean more space.
  - **min-content:** The segment takes up only as much space as its content
    requires. Always use this for vertical layouts or segments containing
    "behavior" fields.
  - **max-content:** The segment takes up as much space as available.
- **fields:** A collection of `Field` objects. The property name for each Field
  must relate to a property available on the item itself, i.e., if the field to
  be rendered is called `fooBar` there must be a `fooBar` on the item, and the
  key in the fields object must also be called `fooBar` since the name is how
  the two are connected in the UI rendering code.
- **orientation:** The orientation of the content within the segment (horizontal
  or vertical).
- **type:** The segment type (block or list).

Use segments sparingly and only to create the logical groupings when it is
necessary for layout.

**8. Presentation**

The presentation defines how an item is displayed:

- **For Lists:**
  - **type:** `list`.
  - **orientation:** Typically vertical. Use horizontal only for carousels.
  - **behaviors:** Actions that can be performed on the list itself (e.g.,
    adding or removing items).
- **For Cards:**
  - **type:** `card`.
  - **orientation:** Typically horizontal. Use vertical if the card has many
    segments.
  - **segments:** An array of `Segment` objects that define the card's
    structure.
  - **behaviors:** Actions that can be performed on the card itself (e.g.,
    editing fields within the card).

**9. Item**

An item is the top-level entity. It contains the data to be displayed and the
`presentation` that defines how to display it.

**Example Spec Outputs**

1.  **A Card with a Title and Description:**

    - What does it represent: a file in a folder.
    - The item is a card that has vertical orientation.
    - It has one segment.
    - This segment is a block, has a vertical orientation, and contains
      - a "title" field that is "particle-ui-text" with the title "Title" and a
        "hero" modifier.
      - a "description" field that is "particle-ui-long-text" with the title
        "Description".

2.  **A Card with an Image and non-editable Title and Description:**

    - What does it represent: an informational item with an image, title and
      some text.
    - The item is a card that has horizontal orientation.
    - It has two segments.
    - The first segment has a weight of 1.5 and vertical orientation, and
      contains:
      - an "particle-ui-image" image field.
    - The second segment has a weight of 3 and vertical orientation
      - a text field that acts a headline and which is "particle-ui-text" with
        the "hero" modifier.
      - a "particle-ui-long-text" field which describes the content in more
        detail.

3.  **A Card with an Image and Editable Text:**

    - What does it represent: UI for editing picture caption.
    - The item is a card that has vertical orientation.
    - It has one segment.
    - This segment has a weight of 1 and vertical orientation, and it contains:
      - an "image" field that is a "particle-ui-image" with a "hero" modifier.
        The image's "title" is that of the item.
      - a "text" field that is "particle-ui-text" with the title "Caption" and
        "editable" behavior.

4.  **A Card with Two Segments, Last one containing a Delete Button:**

    - What does it represent: a user profile.
    - The item is a card that has horizontal orientation.
    - It has two segments.
    - The first segment is a block, has a weight of 3, has a horizontal
      orientation, and contains:
      - a "name" field that is a "particle-ui-text" with the title "Name".
      - an "age" field that is a "particle-ui-number" with the title "Age".
    - The second segment is a block, has a weight of "min-content", has a
      horizontal orientation, and contains a "delete" field that is "text" with
      the title "Delete", the icon "delete", and the behavior "delete" rendered
      as "particle-ui-button".

5.  **A Card with Image and Description:**

    - What does it represent: an info card with a short response.
    - Great for: quick facts about someone, a place or thing.
    - The item is a card that has horizontal orientation.
    - It has two equally-weighted segments.
    - The first segment has a weight of 1, has a vertical orientation, and
      contains:
      - a "description" field that is a "particle-ui-long-text" with the
        modifier of "hero".
    - The second segment has a weight of 1 and contains:
      - an "image" fiel that is a "particle-ui-image".

**Key Considerations for Specs:**

- Specify what the element represents.
- Be explicit about the element type (card or list).
- Specify the orientation for the overall element, and for each segment.
- Clearly define the fields within each segment, including their types, titles,
  and any associated behaviors or modifiers.
- Consider the weighting of segments to control layout.
- When using the "hero" modifier for images, ensure that the item has a vertical
  orientation.
- Behavior segments must be in a list segment.
- Images require a lot of space, so be sure to weight them accordingly. If there
  is a lot of information overall, use a vertical layout.
- If you set an image to be a "hero" you must always provide a meaningful title,
  which is the item's title.
