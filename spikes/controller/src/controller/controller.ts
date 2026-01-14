/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugContextValues, debugGlobalLogLevel } from "./context/debug.js";
import { DrawingController } from "./subcontrollers/drawing/drawing.js";
import { LayoutController } from "./subcontrollers/layout/layout.js";
import { SimpleController } from "./subcontrollers/simple/simple.js";
import { TextValueController } from "./subcontrollers/text-value/text-value.js";
import { ThemeController } from "./subcontrollers/theme/theme.js";

export class Controller {
  theme = new ThemeController();
  text = new TextValueController();
  layout = new LayoutController();
  drawing = new DrawingController();
  nested = { simple: new SimpleController() };
  debug = {
    log: debugGlobalLogLevel,
    show: false,
    values: debugContextValues,
  };
}
