/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { setDebuggableAppController } from "./utils/logging/logger.js";
import { DebugController } from "./subcontrollers/debug-controller.js";
import { FeedbackController } from "./subcontrollers/feedback-controller.js";
import * as Editor from "./subcontrollers/editor/editor.js";
import { DebuggableAppController } from "./types.js";

class Controller {
  editor = {
    main: new Editor.EditorController("Editor_Main"),
    sidebar: {
      settings: new Editor.Sidebar.SettingsController(
        "Editor_Sidebar_Settings"
      ),
    },
  };
  global = {
    debug: new DebugController("Debug"),
    feedback: new FeedbackController("Feedback"),
  };
}

export const appController = new Controller();
setDebuggableAppController(appController);

export interface AppController extends DebuggableAppController {
  editor: {
    main: Editor.EditorController;
    sidebar: {
      settings: Editor.Sidebar.SettingsController;
    };
  };
  global: {
    debug: DebugController;
    feedback: FeedbackController;
  };
}
