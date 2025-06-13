/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Channel,
  ReceiverProxy,
  SerializedTodoList,
  SuipUpdate,
  TodoItem,
  TodoList,
} from "./types/types";

export { Generator };

class Generator implements ReceiverProxy {
  #model: TodoList;

  constructor(private readonly channel: Channel) {
    this.#model = Store.get();
    for (const [id, item] of this.#model.items) {
      this.update({ create: { path: [id], item } });
    }
  }

  update(update: SuipUpdate) {
    return this.channel.update(update);
  }

  async addItem(): Promise<void> {
    // TODO: Remove this and add presentation info.
    const item: TodoItem = { title: "", done: false } as TodoItem;
    const id = globalThis.crypto.randomUUID();
    this.#model.items.set(globalThis.crypto.randomUUID(), item);

    Store.set(this.#model);
    return this.update({ create: { path: [id], item } });
  }

  async updateField(
    parentId: string,
    id: string,
    value: string
  ): Promise<void> {
    const item = this.#model.items.get(parentId);
    const field = id as keyof TodoItem;
    if (!item) {
      return;
    }

    Reflect.set(item, field, value);
    Store.set(this.#model);
    return this.update({ change: { path: [parentId, id], value } });
  }

  async updateDone(id: string, value: boolean): Promise<void> {
    const item = this.#model.items.get(id);
    if (!item) {
      return;
    }
    item.done = value;
    Store.set(this.#model);
    return this.update({
      change: { path: [id, "done"], value: JSON.stringify(value) },
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    this.#model.items.delete(itemId);
    Store.set(this.#model);
    return this.update({ remove: { path: [itemId] } });
  }
}

class Store {
  static LOCAL_STORAGE_KEY = "TODO_LIST";

  private static fromSerialized(s: string | null): TodoList {
    // TODO: Remove this and add presentation info.
    const blank = { items: new Map() } as TodoList;
    if (!s) {
      return blank;
    }
    try {
      const json = JSON.parse(s) as SerializedTodoList;
      return {
        items: new Map(json.items!),
      } as TodoList; // TODO: Remove this and add presentation info.
    } catch (e) {
      console.warn("Unable to parse/process list, returning blank", e);
      return blank;
    }
  }

  private static toSerialized(list: TodoList): string {
    const serialized: SerializedTodoList = {
      items: [...list.items.entries()],
    };
    return JSON.stringify(serialized);
  }

  static get(): TodoList {
    const list = Store.fromSerialized(
      localStorage.getItem(Store.LOCAL_STORAGE_KEY)
    );
    console.log("GET", list);
    return list;
  }

  static set(list: TodoList) {
    localStorage.setItem(Store.LOCAL_STORAGE_KEY, Store.toSerialized(list));
    console.log("SET", list);
  }
}
