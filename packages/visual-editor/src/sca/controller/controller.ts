/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DebuggableAppController, HydratedController } from "../types.js";
import { BoardController } from "./subcontrollers/board/board-controller.js";
import type { AppEnvironment } from "../environment/environment.js";
import { isHydratedController } from "../utils/helpers/helpers.js";

import * as Global from "./subcontrollers/global/global.js";
import * as Editor from "./subcontrollers/editor/editor.js";
import * as Home from "./subcontrollers/home/home.js";
import * as Run from "./subcontrollers/run/run.js";
import * as Migrations from "./migration/migrations.js";
import { RouterController } from "./subcontrollers/router/router-controller.js";

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
  run: AppController["run"];
  router: AppController["router"];

  constructor(env: AppEnvironment) {
    const runtimeFlags = env.flags.env();

    this.editor = {
      graph: new Editor.Graph.GraphController(
        "Editor_Graph",
        "GraphController"
      ),
      selection: new Editor.Selection.SelectionController(
        "Editor_Selection",
        "SelectionController"
      ),
      splitter: new Editor.Splitter.SplitterController(
        "Editor_Splitter",
        "SplitterController"
      ),
      sidebar: new Editor.Sidebar.SidebarController(
        "Editor_Sidebar",
        "SidebarController"
      ),
      step: new Editor.Step.StepController("Editor_Step", "StepController"),
      share: new Editor.Share.ShareController(
        "Editor_Share",
        "ShareController",
        env
      ),
      theme: new Editor.Theme.ThemeController(
        "Editor_Theme",
        "ThemeController"
      ),
      fastAccess: new Editor.FastAccess.FastAccessController(
        "Editor_FastAccess",
        "FastAccessController"
      ),
      integrations: new Editor.Integrations.IntegrationsController(
        "Editor_Integrations",
        "IntegrationsController"
      ),
      graphEditingAgent:
        new Editor.GraphEditingAgent.GraphEditingAgentController(
          "Editor_GraphEditingAgent",
          "GraphEditingAgentController"
        ),
      notebookLmPicker: new Editor.NotebookLmPicker.NotebookLmPickerController(
        "Editor_NotebookLmPicker",
        "NotebookLmPickerController"
      ),
    };

    this.home = {
      recent: new Home.RecentBoardsController(
        "RecentBoards",
        "RecentBoardsController"
      ),
    };

    this.global = {
      main: new Global.GlobalController("Global", "GlobalController"),
      flags: new Global.FlagController("Flags", "FlagController", env.flags),
      debug: new Global.DebugController("Debug", "DebugController"),
      feedback: new Global.FeedbackController("Feedback", "FeedbackController"),
      flowgenInput: new Global.FlowgenInputController(
        "FlowgenInput",
        "FlowgenInputController"
      ),
      toasts: new Global.ToastController("Toasts", "ToastController"),
      snackbars: new Global.SnackbarController(
        "Snackbars",
        "SnackbarController"
      ),
      statusUpdates: new Global.StatusUpdatesController(
        "StatusUpdates",
        "StatusUpdatesController"
      ),
      consent: new Global.ConsentController("Consent", "ConsentController"),
      onboarding: new Global.OnboardingController(
        "Onboarding",
        "OnboardingController"
      ),
      screenSize: new Global.ScreenSizeController(
        "ScreenSize",
        "ScreenSizeController"
      ),

      // Migrations are tested independently so this block is ignored for
      // coverage reporting.

      /* c8 ignore start */
      async performMigrations() {
        const controller = appController();
        if (!controller) {
          // eslint-disable-next-line no-console -- bootstrap: controller may not exist
          console.warn("Unable to complete migrations; no controller instance");
        }

        // List of migrations to await. These should be done in sequence rather
        // than with a Promise.all() as the migrations are not necessarily
        // independent of each other.
        await Migrations.recentBoardsMigration(controller.home.recent);
        await Migrations.flagsMigration(controller.global.flags, runtimeFlags);
        await Migrations.flagsV1ResetMigration(controller.global.flags);
        await Migrations.statusUpdatesMigration(
          controller.global.statusUpdates
        );
        await Migrations.mcpServersMigration(controller.editor.integrations);
      },
      /* c8 ignore end */
    };

    this.board = {
      main: new BoardController("Board", "BoardController"),
    };

    this.run = {
      main: new Run.RunController("Run", "RunController"),
      renderer: new Run.RendererController(
        "Run_Renderer",
        "RendererController"
      ),
      screen: new Run.ScreenController("Run_Screen", "ScreenController"),
    };

    this.router = new RouterController();
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
export const appController = (env?: AppEnvironment): Controller => {
  if (!controller) {
    if (!env)
      throw new Error(
        "App Controller must be instantiated with an Environment"
      );
    controller = new Controller(env);
  }

  return controller;
};

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export interface AppController extends DebuggableAppController {
  editor: {
    graph: Editor.Graph.GraphController;
    selection: Editor.Selection.SelectionController;
    splitter: Editor.Splitter.SplitterController;
    sidebar: Editor.Sidebar.SidebarController;
    step: Editor.Step.StepController;
    share: Editor.Share.ShareController;
    theme: Editor.Theme.ThemeController;
    fastAccess: Editor.FastAccess.FastAccessController;
    integrations: Editor.Integrations.IntegrationsController;
    graphEditingAgent: Editor.GraphEditingAgent.GraphEditingAgentController;
    notebookLmPicker: Editor.NotebookLmPicker.NotebookLmPickerController;
  };
  home: {
    recent: Home.RecentBoardsController;
  };
  global: {
    main: Global.GlobalController;
    /**
     * Migration-only persistence shell. Do NOT use for runtime flag access:
     * use `env.flags` instead. Will be removed once all users have migrated.
     * @internal
     */
    flags: Global.FlagController;
    debug: Global.DebugController;
    feedback: Global.FeedbackController;
    flowgenInput: Global.FlowgenInputController;
    toasts: Global.ToastController;
    snackbars: Global.SnackbarController;
    statusUpdates: Global.StatusUpdatesController;
    consent: Global.ConsentController;
    onboarding: Global.OnboardingController;
    screenSize: Global.ScreenSizeController;
    performMigrations(): Promise<void>;
  };
  board: {
    main: BoardController;
  };
  run: {
    main: Run.RunController;
    renderer: Run.RendererController;
    screen: Run.ScreenController;
  };
  router: RouterController;
  isHydrated: Promise<number[]>;
}
