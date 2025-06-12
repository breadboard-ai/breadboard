/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receiver } from "./receiver.js";
import { Item } from "./state/item.js";
import { GeneratorProxy, TodoItem } from "./types/types.js";

export { Generator };

class Generator implements GeneratorProxy {
  #receiver: Receiver | undefined;

  connect(receiver: Receiver) {
    this.#receiver = receiver;
  }

  async requestUpdateField(
    parentId: string,
    id: string,
    value: string
  ): Promise<void> {
    const item = this.#receiver?.list.items?.get(parentId);
    const field = id as keyof TodoItem;
    if (!item) {
      return;
    }

    Reflect.set(item, field, value);
  }

  async requestUpdateDone(id: string, value: boolean): Promise<void> {
    const item = this.#receiver?.list.items?.get(id);
    if (!item) {
      return;
    }
    item.done = value;
  }

  async requestAddItem(): Promise<void> {
    const item = new Item("");
    item.done = false;
    this.#receiver?.list.items?.set(globalThis.crypto.randomUUID(), item);
  }

  async requestDelete(itemId: string): Promise<void> {
    this.#receiver?.list.items.delete(itemId);
  }
}
