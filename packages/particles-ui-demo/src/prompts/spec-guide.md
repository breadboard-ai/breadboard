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

Fields represent individual pieces of data within a segment.

- The rendering type of the field:
  - **text:** A single line of text.
  - **longtext:** Multiple lines of text.
  - **number:** A numerical value.
  - **date:** A date value.
  - **behavior:** A UI element that triggers an action (e.g., a button).
  - **image:** An image.
- **behaviors:** Actions that the user can perform on the field (e.g. "delete",
  when `as` is set to "behavior").
- **modifiers:** Visual adjustments or enhancements to the field (e.g., "hero").
- **title:** A label for the field.
- **src:** (For images) The URL of the image.
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
- **fields:** A collection of `Field` objects.
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
      - a "title" field that is "text" with the title "Title".
      - a "description" field that is "longtext" with the title "Description".

2.  **A Card with an Image and Editable Text:**

    - What does it represent: UI for editing picture caption.
    - The item is a card that has vertical orientation.
    - It has one segment.
    - This segment has a vertical orientation, and contains:
      - an "image" field that is an "image" with a "hero" modifier.
      - a "text" field that is "text" with the title "Caption" and "editable"
        behavior.

3.  **A Card with Two Segments, Last one containing a Delete Button:**

    - What does it represent: a user profile.
    - The item is a card that has horizontal orientation.
    - It has two segments.
    - The first segment is a block, has a weight of 3, has a horizontal
      orientation, and contains:
      - a "name" field that is a "text" with the title "Name".
      - an "age" field that is a "number" with the title "Age".
    - The second segment is a block, has a weight of "min-content", has a
      horizontal orientation, and contains a "delete" field that is "text" with
      the title "Delete", the icon "delete", and the behavior "delete".

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
- When providing a list it is incredibly important that you use the correct type
  values for enums, in particular their case. You must always match the correct
  type structures.
