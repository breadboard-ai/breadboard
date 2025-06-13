/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DataParticle, TextParticle } from "@breadboard-ai/particles";

export enum Orientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

/**
 * Available element types
 * - card -- renders a card. A card can be used to present any item of content
 *           that is logically grouped together.
 * - list -
 */
export enum ElementType {
  CARD = "card",
  LIST = "list",
}

export enum SegmentType {
  BLOCK = "block",
  LIST = "list",
}

export type Behavior = "editable" | "delete";
export type Modifier = "hero";

export interface Field {
  as: "text" | "longstring" | "number" | "date" | "behavior" | "image";
  behaviors?: Behavior[];
  modifiers?: Modifier[];
  title?: string;
  src?: string;
  icon?: string;
}

type Segmentable = Exclude<keyof TodoItem, "presentation">;
type Behavioral = Exclude<Behavior, "editable">;
type Static = "static";

export interface Segment {
  weight: number | "min-content" | "max-content";
  fields: Partial<{ [K in Segmentable | Behavioral | Static]: Field }>;
  orientation: Orientation;
  type: SegmentType;
}

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

export interface TodoItem {
  title: string;
  done: boolean;
  description?: string;
  dueDate?: Date;
  presentation: Presentation;
}

export type TodoList = {
  items: TodoItems;
  presentation: Presentation;
};

export type TodoItemListTitle = string;
export type TodoItems = Map<TodoItemListTitle, TodoItem>;

// This is a hack for simplicity.
// TODO: Make this a series of updates, rather than snapshot-based.
export type SerializedParticle =
  | TextParticle
  | DataParticle
  | SerializedGroupParticle;

export type SerializedGroupParticle = [
  key: string,
  value: SerializedParticle,
][];

export type SerializedTodoList = {
  items: [id: TodoItemListTitle, item: TodoItem][];
};

export type SuipUpdateCreate = {
  create: {
    path: string[];
    item: TodoItem;
  };
};

export type SuipUpdateChange = {
  change: {
    path: string[];
    value: string | boolean;
  };
};

export type SuipUpdateRemove = {
  remove: {
    path: string[];
  };
};

export type SuipUpdate = SuipUpdateCreate | SuipUpdateChange | SuipUpdateRemove;

export type SuipEvent = {
  type: string;
  path: string[];
  value?: string;
};

export type EventChannel = {
  dispatch(event: SuipEvent): Promise<void>;
};

export type UpdateChannel = {
  update(update: SuipUpdate): Promise<void>;
};

/**
 * The Receiver side of the channel, a proxy that represents the Generator.
 */
export type GeneratorProxy = {
  requestAddItem(): Promise<void>;
  requestUpdateField(
    parentId: string,
    id: string,
    value: string | boolean
  ): Promise<void>;
  requestDelete(itemId: string): Promise<void>;
};

/**
 * The Generator side of the channel, a proxy that represents the Receiver.
 */
export type ReceiverProxy = {
  addItem(): Promise<void>;
  updateField(parentId: string, id: string, value: string): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
};
