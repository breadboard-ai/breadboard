/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Presentation } from "../types/particles.js";
import { ItemList, ItemState } from "../types/types.js";
import { SignalMap } from "signal-utils/map";

export { List };

class List implements ItemList {
  items = new SignalMap<string, ItemState>();
  presentation: Presentation = {
    type: "list",
    orientation: "vertical",
    behaviors: [],
  };
}
