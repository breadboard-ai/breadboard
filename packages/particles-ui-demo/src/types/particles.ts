/**
 * Specifies orientation of the layout: horizontal lays out items as columns,
 * vertical lays out items as rows.
 */
export enum Orientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

/**
 * Available element types
 * - card -- renders a card. A card can be used to present any item of content
 *           that is logically grouped together.
 * - list - renders a list of items.
 */
export enum ElementType {
  CARD = "card",
  LIST = "list",
}

/**
 * Type of the segment within an item.
 */
export enum SegmentType {
  BLOCK = "block",
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
 * peers. Useful for emphasizing an item.
 */
export type Modifier = "hero";

/**
 * Specifies a content field for a given segment.
 */
export interface Field {
  as: "text" | "longstring" | "number" | "date" | "behavior" | "image";
  behaviors?: Behavior[];
  modifiers?: Modifier[];
  title?: string;
  src?: string;
  icon?: string;
}

type Segmentable = string;
type Behavioral = Exclude<Behavior, "editable">;
type Static = "static";

export interface Segment {
  weight: number | "min-content" | "max-content";
  fields: Partial<{ [K in Segmentable | Behavioral | Static]: Field }>;
  orientation: Orientation;
  type: SegmentType;
}

/**
 * The root elements of the UI.
 */
export type Presentation =
  | {
      type: ElementType.LIST;
      orientation: Orientation;
      behaviors: Behavior[];
    }
  | {
      type: ElementType.CARD;
      orientation: Orientation;
      segments: Segment[];
      behaviors: Behavior[];
    };
