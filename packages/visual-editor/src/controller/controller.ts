/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { setDebuggableAppController } from "./utils/logging/logger.js";
import { DebugController } from "./subcontrollers/debug-controller.js";
import * as Editor from "./subcontrollers/editor/editor.js";
import { DebuggableAppController } from "./types.js";

class Controller {
  editor = {
    sidebar: {
      settings: new Editor.Sidebar.SettingsController(),
    },
  };
  debug = new DebugController();
}

export const appController = new Controller();
setDebuggableAppController(appController);

export interface AppController extends DebuggableAppController {
  editor: {
    sidebar: {
      settings: Editor.Sidebar.SettingsController;
    };
  };
  debug: DebugController;
}
