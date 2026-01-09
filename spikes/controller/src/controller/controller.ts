/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugContextValues } from "./context/debug.js";
import { DrawingStore } from "./subcontrollers/drawing/drawing.js";
import { LayoutStore } from "./subcontrollers/layout/layout.js";
import { SimpleStore } from "./subcontrollers/simple/simple.js";
import { TextValueStore } from "./subcontrollers/text-value/text-value.js";
import { ThemeStore } from "./subcontrollers/theme/theme.js";

export class Controller {
  theme = new ThemeStore();
  text = new TextValueStore();
  layout = new LayoutStore();
  drawing = new DrawingStore();
  nested = { simple: new SimpleStore() };
  debug = {
    show: true,
    values: debugContextValues,
  };
}
