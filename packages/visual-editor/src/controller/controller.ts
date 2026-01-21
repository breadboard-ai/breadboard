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
import { RuntimeFlags } from "@breadboard-ai/types";
import { FlagController } from "./subcontrollers/flag-controller.js";
import { GlobalController } from "./subcontrollers/global/global.js";

class Controller implements AppController {
  editor: AppController["editor"];
  home: AppController["home"];
  global: AppController["global"];

  constructor(flags: RuntimeFlags) {
    const runtimeFlags = flags;

    this.editor = {
      main: new Editor.EditorController("Editor_Main"),
      sidebar: {
        settings: new Editor.Sidebar.SettingsController(
          "Editor_Sidebar_Settings"
        ),
      },
    };

    this.home = {
      recent: new Home.RecentBoardsController("RecentBoards"),
    };

    this.global = {
      main: new GlobalController("Global"),
      flags: new FlagController("Flags", runtimeFlags),
      debug: new DebugController("Debug"),
      feedback: new FeedbackController("Feedback"),
      toasts: new ToastController("Toasts"),

      // Migrations are tested independently so this block is ignored for coverage
      // However c8 needs to know the number of lines to ignore, so number below
      // needs to be kept in sync with the size of performMigrations.
      /* c8 ignore next 10 */
      async performMigrations() {
        const controller = appController();
        if (!controller) {
          console.warn("Unable to complete migrations; no controller instance");
        }

        // List of migrations to await.
        await Migrations.recentBoardsMigration(controller.home.recent);
        await Migrations.flagsMigration(controller.global.flags, runtimeFlags);
      },
    };
  }

  /* c8 ignore next 12 */
  get isHydrated(): Promise<number[]> {
    return Promise.all([
      this.editor.main.isHydrated,
      this.editor.sidebar.settings.isHydrated,
      this.home.recent.isHydrated,
      this.global.main.isHydrated,
      this.global.flags.isHydrated,
      this.global.debug.isHydrated,
      this.global.feedback.isHydrated,
      this.global.toasts.isHydrated,
    ]);
  }
}

let controller: Controller;
export const appController = (flags?: RuntimeFlags) => {
  if (!controller) {
    if (!flags)
      throw new Error("App Controller must be instantiated with flags");
    controller = new Controller(flags);
    setDebuggableAppController(controller);
  }

  return controller;
};

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
    main: GlobalController;
    flags: FlagController;
    debug: DebugController;
    feedback: FeedbackController;
    toasts: ToastController;
    performMigrations(): Promise<void>;
  };
  isHydrated: Promise<number[]>;
}
