/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TodoItem } from "../types/types.js";
import { signal } from "signal-utils";

export { Item };

class Item implements TodoItem {
  @signal
  accessor title: string;

  @signal
  accessor done: boolean = false;

  @signal
  accessor description: string | undefined = undefined;

  @signal
  accessor dueDate: Date | undefined = undefined;

  constructor(title: string) {
    this.title = title;
  }

  static from(item: TodoItem): Item {
    const newItem = new Item(item.title);
    newItem.done = !!item.done;
    newItem.description = item.description;
    newItem.dueDate = item.dueDate;
    return newItem;
  }
}
