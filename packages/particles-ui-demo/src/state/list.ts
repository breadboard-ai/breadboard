/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ElementType,
  Orientation,
  Presentation,
  TodoItems,
  TodoList,
} from "../types/types.js";
import { SignalMap } from "signal-utils/map";

export { List };

class List implements TodoList {
  items: TodoItems = new SignalMap();
  presentation: Presentation = {
    type: ElementType.LIST,
    orientation: Orientation.VERTICAL,
    behaviors: [],
  };
}
