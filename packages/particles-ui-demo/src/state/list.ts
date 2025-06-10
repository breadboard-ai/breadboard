/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TodoItems } from "../types/types.js";
import { SignalMap } from "signal-utils/map";

export { List };

class List {
  items: TodoItems = new SignalMap();
}
