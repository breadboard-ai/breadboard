/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditableGraph } from "@breadboard-ai/types";
import { AppController } from "../../../src/sca/controller/controller.js";
import { AppServices } from "../../../src/sca/services/services.js";
import { RunController } from "../../../src/sca/controller/subcontrollers/run/run-controller.js";

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
    run: {
      main: new RunController("test-run-controller", "test"),
    },
    router: {
      updateFromCurrentUrl: () => { },
      init: () => { },
    },
  } as unknown as AppController;
}

const defaultAgentContext = {
  invalidateResumableRuns: () => { },
};

/**
 * Creates a mock runner that can fire events to its registered listeners.
 * This avoids the EventTarget/Event module boundary issue in tests.
 */
export function createMockRunner() {
  const listeners: Record<string, (() => void)[]> = {};
  const runner = {
    addEventListener: (event: string, handler: () => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
    },
    removeEventListener: () => { },
    start: () => { },
    running: () => false,
    // Helper for tests to fire events
    _fireEvent: (event: string) => {
      if (listeners[event]) {
        listeners[event].forEach(h => h());
      }
    },
  };
  return runner;
}

export function makeTestServices(
  agentContext = defaultAgentContext
): AppServices {
  return {
    agentContext,
    // Mock googleDriveBoardServer for registerSaveStatusListener
    googleDriveBoardServer: {
      addEventListener: () => { },
      removeEventListener: () => { },
    },
    // Mock RunService that returns a testable mock runner
    runService: {
      createRunner: () => {
        const mockRunner = createMockRunner();
        const abortController = new AbortController();
        return { runner: mockRunner, abortController };
      },
    },
    // Mock graphStore with fileSystem for run actions
    graphStore: {
      fileSystem: {
        env: () => [],
        createRunFileSystem: () => ({}),
      },
    } as unknown as AppServices["graphStore"],
    // Mock loader for run actions
    loader: {} as unknown as AppServices["loader"],
    kits: [],
  } as unknown as AppServices;
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
