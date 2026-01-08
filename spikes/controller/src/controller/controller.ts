/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrawingStore } from "./subcontrollers/drawing.js";
import { LayoutStore } from "./subcontrollers/layout.js";
import { TextValueStore } from "./subcontrollers/text-value.js";
import { ThemeStore } from "./subcontrollers/theme.js";

export class Controller {
  theme = new ThemeStore();
  text = new TextValueStore();
  layout = new LayoutStore();
  drawing = new DrawingStore();
}
