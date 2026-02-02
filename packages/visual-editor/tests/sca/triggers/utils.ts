/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mock } from "node:test";
import type { EditableGraph, GraphDescriptor } from "@breadboard-ai/types";
import { AppController } from "../../../src/sca/controller/controller.js";
import { AppServices } from "../../../src/sca/services/services.js";
import { RunController } from "../../../src/sca/controller/subcontrollers/run/run-controller.js";
import type { FlowGenerator } from "../../../src/ui/flow-gen/flow-generator.js";
import type { FlowgenInputStatus } from "../../../src/sca/controller/subcontrollers/global/flowgen-input-controller.js";
import { makeTestGraphStore } from "../../helpers/_graph-store.js";
import { testKit } from "../../test-kit.js";
import type { Project } from "../../../src/ui/state/types.js";

/**
 * Creates a minimal test graph descriptor.
 */
export function makeTestGraph(): GraphDescriptor {
  return {
    nodes: [],
    edges: [],
    url: "test://board",
  };
}

/**
 * Creates a mock project state for flowgen testing.
 */
export function makeTestProjectState(): Project {
  return {
    themes: {
      generateThemeFromIntent: mock.fn(() =>
        Promise.resolve({ error: "skipped" })
      ),
    },
  } as unknown as Project;
}

const defaultGraph = {
  version: 0,
  graphIsMine: true,
};

/**
 * Creates a mock FlowgenInputController for testing.
 * Matches the actual controller interface: inputValue and state are directly settable,
 * with a clear() method to reset both.
 */
function makeMockFlowgenInput() {
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
 * Helper to create a graph store with editor for testing.
 */
export function makeTestGraphStoreWithEditor() {
  const graphStore = makeTestGraphStore({ kits: [testKit] });
  const testGraph: GraphDescriptor = { nodes: [], edges: [] };
  const editor = graphStore.editByDescriptor(testGraph);
  if (!editor) throw new Error("Unable to edit graph");
  return { graphStore, editor };
}

export interface TestControllerOptions {
  /** Editor to use - if provided, creates controller with editor-backed graph */
  editor?: ReturnType<typeof makeTestGraphStoreWithEditor>["editor"];
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
  const main = { blockingAction: false };
  const runStop = mock.fn();

  // Build the controller based on what's provided
  const controller = {
    global: {
      debug: { enabled: true },
      snackbars: { snackbar: () => "mock-id" },
      main,
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
      updateFromCurrentUrl: () => {},
      init: () => {},
    },
    editor: {
      graph: editor ? { editor, lastNodeConfigChange: null } : graph,
    },
  } as unknown as AppController;

  return {
    controller,
    mocks: {
      flowgenInput,
      main,
      runStop,
    },
  };
}

export interface TestFixturesOptions {
  /** If true, creates a graph store with editor. Sets up controller and services accordingly. */
  withEditor?: boolean;
  /** Optional flow generator mock for flowgen tests */
  flowGeneratorMock?: Partial<FlowGenerator>;
  /** Optional agent context override */
  agentContext?: TestServicesOptions["agentContext"];
}

/**
 * Creates all test fixtures (controller, services, and mocks) in a single call.
 * This is the preferred way to set up tests that need both controller and services.
 *
 * When `withEditor: true`, automatically creates a graph store with editor and
 * wires up both controller and services with the appropriate dependencies.
 */
export function makeTestFixtures(options: TestFixturesOptions = {}) {
  const { withEditor = false, flowGeneratorMock, agentContext } = options;

  let graphStore: AppServices["graphStore"] | undefined;
  let editor:
    | ReturnType<typeof makeTestGraphStoreWithEditor>["editor"]
    | undefined;

  if (withEditor) {
    const result = makeTestGraphStoreWithEditor();
    graphStore = result.graphStore;
    editor = result.editor;
  }

  const { controller, mocks: controllerMocks } = makeTestController({ editor });
  const { services, mocks: serviceMocks } = makeTestServices({
    graphStore,
    flowGeneratorMock,
    agentContext,
  });

  return {
    controller,
    services,
    mocks: {
      ...controllerMocks,
      ...serviceMocks,
    },
  };
}

const defaultAgentContext = {
  invalidateResumableRuns: () => {},
};

/**
 * Creates a mock runner that can fire events to its registered listeners.
 * This avoids the EventTarget/Event module boundary issue in tests.
 */
export function createMockRunner() {
  type Handler = (event: { data?: unknown }) => void;
  const listeners: Record<string, Handler[]> = {};
  const runner = {
    addEventListener: (event: string, handler: Handler) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
    },
    removeEventListener: () => {},
    start: () => {},
    running: () => false,
    // Helper for tests to fire events with optional data
    _fireEvent: (event: string, data?: unknown) => {
      if (listeners[event]) {
        listeners[event].forEach((h) => h({ data }));
      }
    },
  };
  return runner;
}

export interface TestServicesOptions {
  agentContext?: typeof defaultAgentContext;
  graphStore?: AppServices["graphStore"];
  flowGeneratorMock?: Partial<FlowGenerator>;
}

export function makeTestServices(options: TestServicesOptions = {}) {
  const {
    agentContext = defaultAgentContext,
    graphStore,
    flowGeneratorMock,
  } = options;

  const actionTrackerMock = {
    flowGenEdit: mock.fn(),
  };

  const services = {
    agentContext,
    // Mock googleDriveBoardServer for registerSaveStatusListener
    googleDriveBoardServer: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    // Mock RunService that returns a testable mock runner
    runService: {
      createRunner: () => {
        const mockRunner = createMockRunner();
        const abortController = new AbortController();
        return { runner: mockRunner, abortController };
      },
    },
    // graphStore - use provided or default mock
    graphStore:
      graphStore ??
      ({
        fileSystem: {
          env: () => [],
          createRunFileSystem: () => ({}),
        },
        // For nodestart event handling
        getByDescriptor: () => ({ success: true, result: {} }),
        inspect: () => ({
          nodeById: (id: string) => ({
            title: () => id,
            currentDescribe: () => ({ metadata: {} }),
          }),
        }),
      } as unknown as AppServices["graphStore"]),
    // Mock loader for run actions
    loader: {} as unknown as AppServices["loader"],
    kits: [],
    // Flowgen mocks (optional)
    ...(flowGeneratorMock && {
      flowGenerator: flowGeneratorMock as FlowGenerator,
      actionTracker: actionTrackerMock,
    }),
  } as unknown as AppServices;

  return {
    services,
    mocks: {
      actionTracker: actionTrackerMock,
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
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as EditableGraph;
}

/**
 * Waits for microtask effects to run.
 */
export async function flushEffects() {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}
