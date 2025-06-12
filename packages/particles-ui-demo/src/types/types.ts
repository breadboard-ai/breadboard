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

export type Channel = {
  requestAddItem(): void;
  requestUpdateField(parentId: string, id: string, value: string): void;
  requestUpdateDone(id: string, value: boolean): void;
  requestDelete(itemId: string): void;
};

export enum Orientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}
