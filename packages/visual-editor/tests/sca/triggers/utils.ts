/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditableGraph } from "@breadboard-ai/types";
import { AppController } from "../../../src/sca/controller/controller.js";
import { AppServices } from "../../../src/sca/services/services.js";

const defaultGraph = {
  version: 0,
  graphIsMine: true,
};

export function makeTestController(graph = defaultGraph): AppController {
  return {
    editor: {
      graph,
    },
    global: {
      debug: {
        enabled: true,
      },
      snackbars: {
        snackbar: () => "mock-id",
      },
    },
    board: {
      main: {
        newerVersionAvailable: false,
      },
    },
  } as unknown as AppController;
}

const defaultAgentContext = {
  invalidateResumableRuns: () => { },
};

export function makeTestServices(
  agentContext = defaultAgentContext
): AppServices {
  return {
    agentContext,
  } as AppServices;
}

/**
 * Creates a mock EditableGraph that has the required methods for the
 * GraphController's setEditor to work.
 */
export function createMockEditor(): EditableGraph {
  return {
    raw: () => ({}),
    addEventListener: () => { },
    removeEventListener: () => { },
  } as unknown as EditableGraph;
}

/**
 * Waits for microtask effects to run.
 */
export async function flushEffects() {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}
