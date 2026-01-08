/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Hints = {
  /**
   * Provides presentation information. If not specified or `null`, the
   * generator of the particle doesn't have an opinion about its presentation.
   *
   * When specified as `string`, can be used to provide hints for presentation.
   * This is useful when the generator of particles and the receiver of the
   * particle can use this string as an identifier for particular presentation
   * that will be used for this particle.
   *
   * When specified as `Presentation`, fully describes the presentation
   * of the particle.
   */
  presentation?: Presentation | string | null;
  /**
   * Provides behavior hints. If not specified, the group particle is just
   * static content. Otherwise, the group particle has event listeners
   * (behaviors) attached to it.
   */
  behaviors?: BehaviorHint[];
};

export type TextParticle = {
  /**
   * Content of the particle.
   */
  text: string;
  /**
   * The type of the content. If omitted, "text/markdown" is assumed.
   */
  mimeType?: string;
} & Hints;

export type DataParticle = {
  /**
   * A URL that points to the data.
   */
  data: string;
  /**
   * The type of the data.
   */
  mimeType: string;
} & Hints;

export type GroupParticle = {
  /**
   * The sub-particles that are part of this group.
   * The Map structure is key for reactive updates.
   */
  group: Map<ParticleIdentifier, Particle>;
  /**
   * The type of a group. Allows the particle to be bound to a particular
   * UI element. Optional. If not specified, the group particle doesn't have
   * an opinion about its type (think "generic grouping").
   * If specified, can be used to identify semantics. For example, can be used
   * to bind to the right custom element.
   */
  type?: string;
} & Hints;

export type BehaviorHint = string;

export type Particle = TextParticle | DataParticle | GroupParticle;

export type ParticleData = TextParticle["text"] | DataParticle["data"];

export type ParticleIdentifier = string;

/**
 * The basics of Semantic UI Protocol (SUIP)
 */

export type SerializedParticle =
  | TextParticle
  | DataParticle
  | SerializedGroupParticle;

export type SerializedGroupParticle = {
  type?: ParticleIdentifier;
  group: [key: string, value: SerializedParticle][];
};

export type JsonRpcNotification<Method extends string, Params> = {
  jsonrpc: "2.0";
  method: Method;
  params: Params;
};

/**
 * Append, Insert, or Replace operation:
 * - when the `path` and `id` match an existing particle, the existing particle
 *   will be replaced with provided particle.
 * - when the `path` and `id` do not match a particle and `before` isn't
 *   specified, the new particle will be appended.
 * - when the `path` and `id` do not match a particle and `before` matches id of
 *   an existing peer particle, new particle will be appended before the it.
 */
export type ParticleUpsertOperation = JsonRpcNotification<
  "suip/ops/upsert",
  {
    /**
     * Path to the parent of the newly added particle.
     */
    path: ParticleIdentifier[];
    /**
     * The id of the particle to add.
     */
    id: ParticleIdentifier;
    /**
     * The particle to add.
     */
    particle: SerializedParticle;
    /**
     * The peer particle id before which to insert the new particle.
     * If not specified or null, the particle will be appended at the end.
     */
    before?: ParticleIdentifier | null;
  }
>;

export type ParticleRemoveOperation = JsonRpcNotification<
  "suip/ops/remove",
  {
    path: ParticleIdentifier[];
  }
>;

export type ParticleOperation =
  | ParticleUpsertOperation
  | ParticleRemoveOperation;

/**
 * Specifies orientation of the layout: horizontal lays out items as columns,
 * vertical lays out items as rows.
 */
export type Orientation = "horizontal" | "vertical";

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
export type ElementType = "card" | "list";

/**
 * Type of the segment within an item. For pictures use a block type, but for
 * anything else use a list type.
 *
 * - media -- The segment contains a single image or video.
 * - block -- The item doesn't require any spacing or padding.
 * - list -- A default padded list of items. If in doubt, use this.
 */
export type SegmentType = "media" | "block" | "list";

/**
 * Defines the behavior associated with the item. When the item is:
 *  - editable -- The user can edit its contents.
 *  - delete -- The user can delete the item.
 *  - clone -- The user can copy the item, by copying to clipboard.
 *  - download -- The user can download the item.
 */
export type Behavior = "editable" | "delete" | "clone" | "download";

/**
 * When modifier "hero" is specified, the item is meant to stand out among its
 * peers. Useful for emphasizing a key item within a block or list. If used on
 * an image you must ensure that the item has a vertical orientation.
 */
export type Modifier = "hero";

/**
 * The supported tags to use within the `as` property of a Field.
 */
export type SupportedTags =
  /** Represents audio data */
  | "particle-viewer-audio"
  /** Represents behavioral buttons like "add", "create", "delete", "edit" */
  | "particle-viewer-button"
  /** Represents code */
  | "particle-viewer-code"
  /** Represents dates and times */
  | "particle-viewer-date"
  /** Represents files */
  | "particle-viewer-file"
  /** Represents Google Drive documents, spreadsheets, and presentations */
  | "particle-viewer-google-drive"
  /** Represents Images */
  | "particle-viewer-image"
  /** Represents Numbers */
  | "particle-viewer-number"
  /** Represents single lines of text */
  | "particle-viewer-text"
  /** Represents longer forms of text like descriptions */
  | "particle-viewer-long-text"
  /** Represents Videos */
  | "particle-viewer-video"
  /** Custom elements that don't fit the above types. */
  | string;

/** Specifies the name of the field in a segment */
export type FieldName = string;

/**
 * Specifies a content field for a given segment.
 */
export interface Field {
  /**
   * The rendering type of the content field. Used to ensure that the element
   * is rendered with the appopriate controls.
   */
  as: SupportedTags;
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
  /**
   * If the field is a behavior try to suggest an appropriate icon.
   */
  icon?: "delete" | "add" | "check";
  /**
   * If there are multiple fields that match the fieldname, define how many
   * should be taken. If missing, assume all.
   */
  take?: number;
}

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
  fields: Record<string, Field>;
  orientation: Orientation;
  type: SegmentType;
}

/**
 * The Presentation information of the item.
 */
export type Presentation =
  | {
      /**
       * Matches the 'list' ElementType above.
       */
      type: "list";
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
      /**
       * Matches the 'card' ElementType above.
       */
      type: "card";
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

/**
 * Represents a particle tree.
 */
export type ParticleTree = {
  readonly root: GroupParticle;
  apply(operation: ParticleOperation): void;
};
