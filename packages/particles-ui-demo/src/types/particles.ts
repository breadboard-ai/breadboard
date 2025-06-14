/**
 * Specifies orientation of the layout: horizontal lays out items as columns,
 * vertical lays out items as rows.
 */
export enum Orientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

/**
 * Available element types:
 * - card -- renders a card. A card can be used to present any item of content
 *           that is logically grouped together. Typically best combined with a
 *           horizontal orientation.
 * - list -- renders a list of items, usually cards. Typically best combined
 *           with a vertical orientation.
 *
 * When including these you must use the value on the right hand side of the
 * enum
 */
export enum ElementType {
  CARD = "card",
  LIST = "list",
}

/**
 * Type of the segment within an item. For pictures use a block type, but for
 * anything else use a list type.
 */
export enum SegmentType {
  /** Best used with images */
  BLOCK = "block",
  /** Best used with any non-image content */
  LIST = "list",
}

/**
 * Defines the behavior associated with the item. When the item is "editable",
 * the user can edit its contents. When the item marked as "delete", it can be
 * deleted.
 */
export type Behavior = "editable" | "delete";

/**
 * When modifier "hero" is specified, the item is meant to stand out among its
 * peers. Useful for emphasizing a key item within a block or list. If used on
 * an image you must ensure that the item has a vertical orientation.
 */
export type Modifier = "hero";

/**
 * Specifies a content field for a given segment.
 */
export interface Field {
  /**
   * The rendering type of the content field. Used to ensure that the element
   * is rendered with the appopriate controls.
   */
  as: "text" | "longtext" | "number" | "date" | "behavior" | "image";
  /**
   * Used to determine what the user can do. If the user is able to edit the
   * field content you must allow them to do so with the appropriate behavior.
   */
  behaviors?: Behavior[];
  /**
   * Adjusts the behavior of the field. If the field is rendered as="image" and
   * it is a significant part of the content, add the appropriate modifier.
   */
  modifiers?: Modifier[];
  /**
   * All fields must have a title.
   */
  title: string;
  src?: string;
  /**
   * If the field is a behavior try to suggest an appropriate icon.
   */
  icon?: "delete" | "add" | "check";
}

type Segmentable = string;
type Behavioral = Exclude<Behavior, "editable">;
type Static = "static";

/**
 * A segment is a part of a card or a list. You use it to break up the
 * information into meaningful chunks. If there is a key piece of information
 * (particularly images) they should be placed in the first segment. Wherever
 * possible you should group fields together and keep the number of
 * segments to an absolute minimum.
 */
export interface Segment {
  /**
   * Specifies the weighting information relative to the item's peers. If the
   * content is orientated horizontally we will use a number to finely control
   * the amount of space each item receives. If the content is orientated
   * vertically, or where the segment is a list of items, "min-content" should
   * be used. If the content contains items with as="behavior" then you should
   * always use "min-content" to create enough space for the items.
   */
  weight: number | "min-content" | "max-content";
  fields: Partial<{ [K in Segmentable | Behavioral | Static]: Field }>;
  orientation: Orientation;
  type: SegmentType;
}

/**
 * The Presentation information of the item.
 */
export type Presentation =
  | {
      type: ElementType.LIST;
      /**
       * By default render a list with vertical orientation.Only
       * use a horizontal orientation when the content is a carousel.
       */
      orientation: Orientation;
      /**
       * Used to allow the user to edit the list, e.g., add or remove items.
       */
      behaviors: Behavior[];
    }
  | {
      type: ElementType.CARD;
      /**
       * By default render a card with horizontal orientation. Only
       * use a vertical orientation when there are a lot of segments.
       */
      orientation: Orientation;
      /**
       * Used to logically separate areas of a card into their own space.
       * Behaviors should always go into their own segment, and that segment
       * should always be the final one in the list. Wherever possible you
       * should group fields together and keep the number of segments to an
       * absolute minimum.
       */
      segments: Segment[];
      /**
       * Used to allow the user to edit fields in the card. If the user should
       * be able to update the information then set the appropriate behavior.
       */
      behaviors: Behavior[];
    };

/**
 * The item. Contains both item's data and its presentation information.
 * The data properties  must match the names in `fields` property.
 */
export type Item = Record<string, unknown> & {
  presentation: Presentation;
};
