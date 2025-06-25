/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Presentation } from "./particles.js";

export type ItemData = Record<string, string | boolean | Date>;

export type ItemState = {
  data: ItemData | undefined;
  presentation: Presentation;
};

export type ItemList = {
  items: Map<string, ItemState>;
  presentation: Presentation;
};
