/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mock } from "node:test";
import type { EditableGraph } from "@breadboard-ai/types";
import { AppController } from "../../../src/sca/controller/controller.js";
import { RunController } from "../../../src/sca/controller/subcontrollers/run/run-controller.js";
import { RendererController } from "../../../src/sca/controller/subcontrollers/run/renderer-controller.js";
import { ScreenController } from "../../../src/sca/controller/subcontrollers/run/screen-controller.js";
import type { FlowgenInputStatus } from "../../../src/sca/controller/subcontrollers/global/flowgen-input-controller.js";
import { ShareController } from "../../../src/sca/controller/subcontrollers/editor/share-controller.js";
import { field } from "../../../src/sca/controller/decorators/field.js";
import { NotebookLmPickerController } from "../../../src/sca/controller/subcontrollers/editor/notebooklm-picker-controller.js";
import { SnackType, SnackbarUUID } from "../../../src/ui/types/types.js";
import { createMockEnvironment } from "./mock-environment.js";
import { defaultRuntimeFlags } from "../controller/data/default-flags.js";

const mockEnv = createMockEnvironment(defaultRuntimeFlags);

/**
 * Shared controller mocks for SCA tests.
 */

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
}

/**
 * Minimal mock of GraphController that uses @field() for signal-backed
 * properties. This ensures signal triggers (like onGraphUrl) work in tests.
 */
class MockGraphController {
  @field()
  accessor url: string | null = null;

  editor?: EditableGraph;
  lastNodeConfigChange = null;
  version = 0;
  graphIsMine = true;

  constructor(editor?: EditableGraph) {
    this.editor = editor;
  }

  // Stubs for GraphController methods called by actions (e.g. run-actions).
  get() {
    return undefined;
  }
  set() {}
}

/**
 * Creates a test controller with all mocks pre-configured.
 * Returns the controller and mocks for test access.
 */
export function makeTestController(options: TestControllerOptions = {}) {
  const { editor } = options;
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
      renderer: new RendererController("test-renderer-controller", "test"),
      screen: new ScreenController("test-screen-controller", "test"),
    },
    router: {
      updateFromCurrentUrl: () => {},
      init: () => {},
    },
    editor: {
      graph: new MockGraphController(editor),
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
      // NOTE(aomarks): I'm instantiating the real ShareController here, so that
      // tests see the real defaults, and can call the real methods. I wonder if
      // we should do the same for all controllers? That would give us better
      // test coverage and eliminate the need to configure mock controller
      // behaviors in tests, since we'd be testing the real behavior of
      // controllers directly.
      share: new ShareController("test-share", "test", mockEnv),
      notebookLmPicker: new NotebookLmPickerController(
        "test-notebookLmPicker",
        "test"
      ),
      theme: {
        status: "idle" as string,
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
 * Options for creating a mock EditableGraph.
 */
export interface MockEditorOptions {
  /** Node ID to return from nodeById - defaults to "test-node" */
  nodeId?: string;
  /** Callback when apply() is called */
  onApply?: (transform: unknown) => void;
  /** Callback when graphchange listener is registered */
  onGraphChange?: (callback: () => void) => void;
  /** Custom raw graph data */
  rawGraph?: Record<string, unknown>;
  /** Mock nodes for testing component update paths */
  mockNodes?: MockNode[];
}

/**
 * Mock node for testing component update paths.
 */
export interface MockNode {
  id: string;
  type: string;
  title?: string;
  description?: string;
  /** If true, ports are still updating (causes async path) */
  portsUpdating?: boolean;
  /** Tags in metadata (causes sync path when present with non-updating ports) */
  tags?: string[];
}

/**
 * Creates a mock EditableGraph that has the required methods for the
 * GraphController's setEditor to work.
 */
export function createMockEditor(options?: MockEditorOptions): EditableGraph {
  const nodeId = options?.nodeId ?? "test-node";
  const defaultNodes = options?.mockNodes?.map((n) => ({
    id: n.id,
    type: n.type,
  })) ?? [{ id: nodeId, type: "promptTemplate" }];
  const rawGraph = {
    edges: [],
    ...(options?.rawGraph ?? {
      nodes: defaultNodes,
    }),
  };
  const mockNodes = options?.mockNodes ?? [];

  // Create mock InspectableNode objects
  const inspectableNodes = mockNodes.map((node) => ({
    descriptor: { id: node.id, type: node.type },
    title: () => node.title ?? node.type,
    description: () => node.description ?? "",
    currentPorts: () => ({
      inputs: { ports: [] },
      outputs: { ports: [] },
      updating: node.portsUpdating ?? false,
    }),
    currentDescribe: () => ({
      metadata: node.tags ? { tags: node.tags } : {},
    }),
    ports: () =>
      Promise.resolve({
        inputs: { ports: [] },
        outputs: { ports: [] },
      }),
    describe: () => Promise.resolve({ metadata: {} }),
  }));

  const mockInspectable = {
    graphs: () => ({}),
    nodes: () => inspectableNodes,
    raw: () => rawGraph,
    nodeById: (id: string) =>
      id === nodeId ? { descriptor: { type: "promptTemplate" } } : undefined,
  };

  return {
    raw: () => rawGraph,
    inspect: () => mockInspectable,
    addEventListener: (_event: string, callback: () => void) => {
      if (options?.onGraphChange) {
        options.onGraphChange(callback);
      }
    },
    removeEventListener: () => {},
    apply: async (transform: unknown) => {
      options?.onApply?.(transform);
      return { success: true };
    },
  } as unknown as EditableGraph;
}

/**
 * Waits for microtask effects to run.
 */
export async function flushEffects() {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}
