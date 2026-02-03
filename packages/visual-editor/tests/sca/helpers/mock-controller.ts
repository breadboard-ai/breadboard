/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mock } from "node:test";
import type { EditableGraph } from "@breadboard-ai/types";
import { AppController } from "../../../src/sca/controller/controller.js";
import { RunController } from "../../../src/sca/controller/subcontrollers/run/run-controller.js";
import type { FlowgenInputStatus } from "../../../src/sca/controller/subcontrollers/global/flowgen-input-controller.js";
import { SnackType, SnackbarUUID } from "../../../src/ui/types/types.js";

/**
 * Shared controller mocks for SCA tests.
 */

const defaultGraph = {
  version: 0,
  graphIsMine: true,
};

/**
 * Creates a mock FlowgenInputController for testing.
 */
export function makeMockFlowgenInput() {
  return {
    inputValue: "",
    state: { status: "initial" } as FlowgenInputStatus,
    clear() {
      this.inputValue = "";
      this.state = { status: "initial" };
    },
  };
}

/**
 * Creates a mock snackbar controller for testing.
 * Tracks all snackbars and provides test helpers.
 */
export function makeMockSnackbarController() {
  const snackbars: Map<SnackbarUUID, { message: string; type: SnackType }> =
    new Map();
  let lastId: SnackbarUUID | null = null;

  return {
    snackbar: (
      message: string,
      type: SnackType,
      _actions?: unknown[],
      _persistent?: boolean,
      _id?: SnackbarUUID,
      _replaceAll?: boolean
    ): SnackbarUUID => {
      const id = _id ?? (globalThis.crypto.randomUUID() as SnackbarUUID);
      snackbars.set(id, { message, type });
      lastId = id;
      return id;
    },
    update: (id: SnackbarUUID, message: string, type: SnackType) => {
      snackbars.set(id, { message, type });
      return true;
    },
    unsnackbar: (id?: SnackbarUUID) => {
      if (id) {
        snackbars.delete(id);
      } else {
        snackbars.clear();
      }
    },
    // Test helpers
    get entries() {
      return snackbars;
    },
    get lastId() {
      return lastId;
    },
  };
}

export interface TestControllerOptions {
  /** Editor to use - if provided, creates controller with editor-backed graph */
  editor?: EditableGraph;
  /** Custom graph for non-editor tests */
  graph?: typeof defaultGraph;
}

/**
 * Creates a test controller with all mocks pre-configured.
 * Returns the controller and mocks for test access.
 */
export function makeTestController(options: TestControllerOptions = {}) {
  const { editor, graph = defaultGraph } = options;
  const flowgenInput = makeMockFlowgenInput();
  const snackbars = makeMockSnackbarController();
  const main = { blockingAction: false };
  const runStop = mock.fn();

  const controller = {
    global: {
      debug: { enabled: true },
      snackbars,
      main,
      toasts: {
        toast: mock.fn(),
        untoast: mock.fn(),
      },
      ...(flowgenInput && { flowgenInput }),
    },
    board: {
      main: { newerVersionAvailable: false },
    },
    run: {
      main: editor
        ? { stop: runStop }
        : new RunController("test-run-controller", "test"),
    },
    router: {
      updateFromCurrentUrl: () => { },
      init: () => { },
    },
    editor: {
      graph: editor ? { editor, lastNodeConfigChange: null } : graph,
      selection: {
        selectionId: 0,
      },
      sidebar: {
        section: null,
      },
      step: {
        pendingEdit: null,
        pendingAssetEdit: null,
        clearPendingEdit: mock.fn(),
        clearPendingAssetEdit: mock.fn(),
      },
    },
  } as unknown as AppController;

  return {
    controller,
    mocks: {
      flowgenInput,
      snackbars,
      main,
      runStop,
    },
  };
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
