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
    main: new Editor.EditorController(),
    sidebar: {
      settings: new Editor.Sidebar.SettingsController(),
    },
  };
  debug = new DebugController();
  feedback = new FeedbackController();
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
  debug: DebugController;
  feedback: FeedbackController;
}
