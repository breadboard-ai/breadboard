/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receiver } from "./receiver.js";
import { Item } from "./state/item.js";
import { Channel, TodoItem } from "./types/types.js";

export { Generator };

class Generator implements Channel {
  #receiver: Receiver | undefined;

  connect(receiver: Receiver) {
    this.#receiver = receiver;
  }

  requestUpdateField(parentId: string, id: string, value: string): void {
    const item = this.#receiver?.list.items?.get(parentId);
    const field = id as keyof TodoItem;
    if (!item) {
      return;
    }

    Reflect.set(item, field, value);
  }

  requestUpdateDone(id: string, value: boolean): void {
    const item = this.#receiver?.list.items?.get(id);
    if (!item) {
      return;
    }
    item.done = value;
  }

  requestAddItem() {
    const item = new Item("");
    item.done = false;
    this.#receiver?.list.items?.set(globalThis.crypto.randomUUID(), item);
  }

  requestDelete(itemId: string) {
    this.#receiver?.list.items.delete(itemId);
  }
}
