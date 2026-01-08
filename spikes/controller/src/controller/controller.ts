/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrawingStore } from "./subcontrollers/drawing";
import { LayoutStore } from "./subcontrollers/layout";
import { TextValueStore } from "./subcontrollers/text-value";
import { ThemeStore } from "./subcontrollers/theme";

export class Controller {
  theme = new ThemeStore();
  text = new TextValueStore();
  layout = new LayoutStore();
  drawing = new DrawingStore();
}
