/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Presentation } from "@breadboard-ai/particles";

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
