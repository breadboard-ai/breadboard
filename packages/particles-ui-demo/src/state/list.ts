/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Presentation } from "@breadboard-ai/particles";
import type { Types } from "@breadboard-ai/particles-ui";
import { SignalMap } from "signal-utils/map";

export { List };

class List implements Types.ItemList {
  items = new SignalMap<string, Types.ItemState>();
  presentation: Presentation = {
    type: "list",
    orientation: "vertical",
    behaviors: [],
  };
}
