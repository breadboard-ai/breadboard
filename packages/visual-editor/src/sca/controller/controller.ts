/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { setDebuggableAppController } from "../utils/logging/logger.js";
import { DebugController } from "./subcontrollers/debug-controller.js";
import { FeedbackController } from "./subcontrollers/feedback-controller.js";
import { DebuggableAppController, HydratedController } from "../types.js";
import { ToastController } from "./subcontrollers/toast-controller.js";
import { SnackbarController } from "./subcontrollers/snackbar-controller.js";
import { RuntimeFlags } from "@breadboard-ai/types";
import { FlagController } from "./subcontrollers/flag-controller.js";
import { GlobalController } from "./subcontrollers/global/global.js";
import { isHydratedController } from "../utils/helpers/helpers.js";

import * as Editor from "./subcontrollers/editor/editor.js";
import * as Home from "./subcontrollers/home/home.js";
import * as Migrations from "./migration/migrations.js";
import { ConsentController } from "./subcontrollers/consent-controller.js";

class Controller implements AppController {
  editor: AppController["editor"];
  home: AppController["home"];
  global: AppController["global"];

  constructor(flags: RuntimeFlags) {
    const runtimeFlags = flags;

    this.editor = {
      graph: new Editor.Graph.GraphController("Editor_Graph"),
      selection: new Editor.Selection.SelectionController("Editor_Selection"),
      splitter: new Editor.Splitter.SplitterController("Editor_Splitter"),
      sidebar: new Editor.Sidebar.SidebarController("Editor_Sidebar"),
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
      snackbars: new SnackbarController("Snackbars"),
      consent: new ConsentController("Consent"),

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

  #walk(collect: HydratedController[] = [], target: unknown = this) {
    if (target === null || typeof target !== "object") {
      return;
    }

    const safeTarget = target as Record<string, unknown>;
    const props = Object.getOwnPropertyNames(safeTarget);

    for (const propName of props) {
      const prop = safeTarget[propName];

      if (isHydratedController(prop)) {
        collect.push(prop);
        continue;
      }
      this.#walk(collect, prop);
    }

    return collect;
  }

  get isHydrated(): Promise<number[]> {
    const controllers: HydratedController[] = [];
    this.#walk(controllers, this);
    return Promise.all(controllers.map((c) => c.isHydrated));
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
    graph: Editor.Graph.GraphController;
    selection: Editor.Selection.SelectionController;
    splitter: Editor.Splitter.SplitterController;
    sidebar: Editor.Sidebar.SidebarController;
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
    snackbars: SnackbarController;
    consent: ConsentController;
    performMigrations(): Promise<void>;
  };
  isHydrated: Promise<number[]>;
}
