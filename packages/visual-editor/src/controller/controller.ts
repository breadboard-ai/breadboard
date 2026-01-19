/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { setDebuggableAppController } from "./utils/logging/logger.js";
import { DebugController } from "./subcontrollers/debug-controller.js";
import { FeedbackController } from "./subcontrollers/feedback-controller.js";
import * as Editor from "./subcontrollers/editor/editor.js";
import * as Home from "./subcontrollers/home/home.js";
import { DebuggableAppController } from "./types.js";
import { ToastController } from "./subcontrollers/toast-controller.js";
import * as Migrations from "./migration/migrations.js";

class Controller {
  editor = {
    main: new Editor.EditorController("Editor_Main"),
    sidebar: {
      settings: new Editor.Sidebar.SettingsController(
        "Editor_Sidebar_Settings"
      ),
    },
  };
  home = {
    recent: new Home.RecentBoardsController("RecentBoards"),
  };
  global = {
    debug: new DebugController("Debug"),
    feedback: new FeedbackController("Feedback"),
    toasts: new ToastController("Toasts"),

    // Migrations are tested independently so this block is ignored for coverage
    // However c8 needs to know the number of lines to ignore, so number below
    // needs to be kept in sync with the size of performMigrations.
    /* c8 ignore next 8 */
    async performMigrations() {
      if (!appController) {
        console.warn("Unable to complete migrations; no controller instance");
      }

      // List of migrations to await.
      await Migrations.recentBoardsMigration(appController.home.recent);
    },
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
  home: {
    recent: Home.RecentBoardsController;
  };
  global: {
    debug: DebugController;
    feedback: FeedbackController;
    toasts: ToastController;
    performMigrations(): Promise<void>;
  };
}
