/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Channel, TodoItem, TodoItemListTitle, TodoList } from "./types/types";

type SerializedTodoList = {
  items: [id: TodoItemListTitle, item: TodoItem][];
};

function fromSerialized(s: string | null): TodoList {
  const blank = { items: new Map() };
  if (!s) {
    return blank;
  }
  try {
    const json = JSON.parse(s) as SerializedTodoList;
    return {
      items: new Map(json.items!),
    };
  } catch (e) {
    console.warn("Unable to parse/process list, returning blank", e);
    return blank;
  }
}

export { Generator };

class Generator implements Channel {
  #model: TodoList;

  constructor() {
    this.#model = fromSerialized(localStorage.getItem("TODO_LIST"));
    console.log("MODEL", this.#model);
  }
}
