/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  App,
  AppScreen,
  ConsoleEntry,
  SimplifiedProjectRunState,
} from "@breadboard-ai/types";
import { SignalMap } from "signal-utils/map";
import { ReactiveConsoleEntry } from "../../state/console-entry.js";
import { ReactiveAppScreen } from "../../state/app-screen.js";
import type { RendererRunState } from "../../state/types.js";

export { createGraphEditingState };
export type { GraphEditingState };

const STEP_ID = "graph-editing-agent";

type GraphEditingState = {
  consoleEntry: ConsoleEntry;
  appScreen: AppScreen;
  projectRunState: SimplifiedProjectRunState;
  stepId: string;
};

/**
 * Creates standalone reactive state for the graph editing overlay.
 *
 * This provides the same signal infrastructure as the full ProjectRun,
 * but scoped to a single synthetic "step" for the graph editing agent.
 * The overlay watches these signals via SignalWatcher to reactively
 * render chat messages and input requests.
 */
function createGraphEditingState(): GraphEditingState {
  const rendererRunState: RendererRunState = {
    nodes: new SignalMap(),
    edges: new SignalMap(),
  };

  const consoleEntry = new ReactiveConsoleEntry(
    STEP_ID,
    rendererRunState,
    { title: "Graph Editing Agent" },
    undefined, // no output schema
    // onInputRequested: auto-activate inputs immediately since there's
    // no queuing — the overlay only has one step.
    () => {
      consoleEntry.activateInput();
    }
  );

  const appScreen = new ReactiveAppScreen("Graph Editing Agent", undefined);

  // Minimal App implementation — just enough for the Loop to function.
  const screens = new SignalMap<string, AppScreen>();
  screens.set(STEP_ID, appScreen);

  const app: App = {
    state: "progress",
    screens,
    current: screens,
    last: appScreen,
  };

  const consoleLookup = new Map<string, ConsoleEntry>();
  consoleLookup.set(STEP_ID, consoleEntry);

  const projectRunState: SimplifiedProjectRunState = {
    console: consoleLookup,
    app,
  };

  return { consoleEntry, appScreen, projectRunState, stepId: STEP_ID };
}
