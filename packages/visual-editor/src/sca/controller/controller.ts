/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { setDebuggableAppController } from "../utils/logging/logger.js";
import { DebuggableAppController, HydratedController } from "../types.js";
import { BoardController } from "./subcontrollers/board/board-controller.js";
import { RuntimeFlags } from "@breadboard-ai/types";
import { isHydratedController } from "../utils/helpers/helpers.js";

import * as Global from "./subcontrollers/global/global.js";
import * as Editor from "./subcontrollers/editor/editor.js";
import * as Home from "./subcontrollers/home/home.js";
import * as Migrations from "./migration/migrations.js";

/**
 * The root application controller that organizes all domain-specific
 * subcontrollers into a hierarchical tree.
 *
 * **Domains:**
 * - `editor`: Workspace state (graph, selection, splitter, sidebar)
 * - `home`: Home screen state (recent boards)
 * - `global`: Application-wide state (flags, toasts, consent, etc.)
 *
 * The controller tree is traversed during hydration to ensure all
 * persisted `@field` values are loaded before the application starts.
 *
 * @see {@link appController} for the singleton factory.
 */
class Controller implements AppController {
  editor: AppController["editor"];
  home: AppController["home"];
  global: AppController["global"];
  board: AppController["board"];

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
      main: new Global.GlobalController("Global"),
      flags: new Global.FlagController("Flags", runtimeFlags),
      debug: new Global.DebugController("Debug"),
      feedback: new Global.FeedbackController("Feedback"),
      toasts: new Global.ToastController("Toasts"),
      snackbars: new Global.SnackbarController("Snackbars"),
      consent: new Global.ConsentController("Consent"),

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

    this.board = {
      main: new BoardController("Board")
    }
  }

  /**
   * Recursively walks the controller tree to find all `HydratedController`
   * instances. Used to aggregate hydration promises from all subcontrollers.
   */
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

  /**
   * Promise that resolves when ALL subcontrollers have finished hydrating
   * their persisted `@field` values from storage.
   *
   * **Usage:**
   * ```typescript
   * await sca.controller.isHydrated;
   * // Now safe to access any persisted field
   * ```
   */
  get isHydrated(): Promise<number[]> {
    const controllers: HydratedController[] = [];
    this.#walk(controllers, this);
    return Promise.all(controllers.map((c) => c.isHydrated));
  }
}

/**
 * Singleton factory for the application controller.
 *
 * On first call, creates the `Controller` instance with the provided flags.
 * Subsequent calls return the existing instance.
 *
 * @param flags - Runtime feature flags (required on first call)
 * @returns The singleton `Controller` instance
 * @throws Error if first call is made without flags
 *
 * @example
 * ```typescript
 * // At app bootstrap
 * const controller = appController(runtimeFlags);
 *
 * // Later access (flags optional)
 * const controller = appController();
 * ```
 */
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
    main: Global.GlobalController;
    flags: Global.FlagController;
    debug: Global.DebugController;
    feedback: Global.FeedbackController;
    toasts: Global.ToastController;
    snackbars: Global.SnackbarController;
    consent: Global.ConsentController;
    performMigrations(): Promise<void>;
  };
  board: {
    main: BoardController;
  };
  isHydrated: Promise<number[]>;
}
