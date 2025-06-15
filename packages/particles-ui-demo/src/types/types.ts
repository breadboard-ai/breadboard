/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DataParticle, TextParticle } from "@breadboard-ai/particles";
import { Presentation } from "./particles";

export type ItemData = Record<string, string | boolean | Date>;

export type ItemState = {
  data: ItemData | undefined;
  presentation: Presentation;
};

export type ItemList = {
  items: Map<string, ItemState>;
  presentation: Presentation;
};

export type TodoItemListTitle = string;

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
  items: [id: TodoItemListTitle, item: ItemList][];
};

export type SuipUpdateCreate = {
  create: {
    path: string[];
    item: ItemState;
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
