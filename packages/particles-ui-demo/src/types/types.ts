/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DataParticle, TextParticle } from "@breadboard-ai/particles";

export interface TodoItem {
  title: string;
  done: boolean;
  description?: string;
  dueDate?: Date;
}

export type TodoList = {
  items: TodoItems;
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
    value: string;
  };
};

export type SuipUpdateRemove = {
  remove: {
    path: string[];
  };
};

export type SuipUpdate = SuipUpdateCreate | SuipUpdateChange | SuipUpdateRemove;

export type Channel = {
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
    value: string
  ): Promise<void>;
  requestUpdateDone(id: string, value: boolean): Promise<void>;
  requestDelete(itemId: string): Promise<void>;
};

/**
 * The Generator side of the channel, a proxy that represents the Receiver.
 */
export type ReceiverProxy = {
  addItem(): Promise<void>;
  updateField(parentId: string, id: string, value: string): Promise<void>;
  updateDone(id: string, value: boolean): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
};

export enum Orientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}
