/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { List } from "./state/list";
import { GeneratorProxy, TodoList } from "./types/types";

export { Receiver };

class Receiver {
  list: TodoList;

  constructor(public readonly channel: GeneratorProxy) {
    this.list = new List();
  }
}
