/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mock } from "node:test";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { AppServices } from "../../../src/sca/services/services.js";
import type { FlowGenerator } from "../../../src/ui/flow-gen/flow-generator.js";
import { makeTestGraphStore } from "../../helpers/_graph-store.js";
import { testKit } from "../../test-kit.js";
import type { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import type { SigninAdapter } from "../../../src/ui/utils/signin-adapter.js";
import type { GoogleDriveBoardServer } from "../../../src/board-server/server.js";

/**
 * Shared services mocks for SCA tests.
 */

const defaultAgentContext = {
  invalidateResumableRuns: () => {},
};

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

/**
 * Creates a mock runner that can fire events to its registered listeners.
 *
 * @param nodes - Optional array of nodes to include in the plan.stages for graphstart pre-population
 */
export function createMockRunner(
  nodes: Array<{ id: string; type?: string }> = []
) {
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
    // Plan property for graphstart pre-population
    plan:
      nodes.length > 0
        ? {
            stages: [nodes.map((n) => ({ node: n }))],
          }
        : undefined,
    // Helper for tests to fire events with optional data
    _fireEvent: (event: string, data?: unknown) => {
      if (listeners[event]) {
        listeners[event].forEach((h) => h({ data }));
      }
    },
  };
  return runner;
}

/**
 * Creates a mock GoogleDriveBoardServer for testing.
 */
export function makeMockBoardServer(options: {
  canSave?: boolean;
  saveResult?: { result: boolean };
  saveShouldThrow?: boolean;
  createUrl?: string;
  createShouldThrow?: boolean;
  deleteShouldThrow?: boolean;
}) {
  let lastSavedGraph: GraphDescriptor | null = null;
  let saveCallCount = 0;
  let createCallCount = 0;
  let deleteCallCount = 0;

  return {
    canProvide: () => ({
      save: options.canSave ?? true,
    }),
    save: async (
      _url: URL,
      graph: GraphDescriptor,
      _userInitiated: boolean
    ) => {
      saveCallCount++;
      if (options.saveShouldThrow) {
        throw new Error("Save failed");
      }
      lastSavedGraph = graph;
      return options.saveResult ?? { result: true };
    },
    create: async (_url: URL, _graph: GraphDescriptor) => {
      createCallCount++;
      if (options.createShouldThrow) {
        throw new Error("Create failed");
      }
      return {
        result: true,
        url: options.createUrl ?? "https://new.com/board.json",
      };
    },
    deepCopy: async (_url: URL, graph: GraphDescriptor) => graph,
    delete: async (_url: URL) => {
      deleteCallCount++;
      if (options.deleteShouldThrow) {
        throw new Error("Delete failed");
      }
      return { result: true };
    },
    // For event bridge support
    addEventListener: () => {},
    removeEventListener: () => {},
    // Test helpers
    get lastSavedGraph() {
      return lastSavedGraph;
    },
    get saveCallCount() {
      return saveCallCount;
    },
    get createCallCount() {
      return createCallCount;
    },
    get deleteCallCount() {
      return deleteCallCount;
    },
  };
}

export interface TestServicesOptions {
  agentContext?: typeof defaultAgentContext;
  graphStore?: AppServices["graphStore"];
  flowGeneratorMock?: Partial<FlowGenerator>;
  /** Custom metadata for mock nodes - keyed by node ID */
  nodeMetadata?: Record<
    string,
    { title?: string; icon?: string; tags?: string[] }
  >;
  googleDriveClient?: Partial<GoogleDriveClient>;
  signinAdapter?: Partial<SigninAdapter>;
  googleDriveBoardServer?: Partial<
    Omit<GoogleDriveBoardServer, "ops"> & {
      ops?: Partial<GoogleDriveBoardServer["ops"]>;
    }
  >;
}

export function makeTestServices(options: TestServicesOptions = {}) {
  const {
    agentContext = defaultAgentContext,
    graphStore,
    flowGeneratorMock,
    nodeMetadata = {},
    googleDriveClient,
    signinAdapter,
    googleDriveBoardServer,
  } = options;

  const actionTrackerMock = {
    flowGenEdit: mock.fn(),
  };

  const services = {
    agentContext,
    // Mock googleDriveBoardServer for registerSaveStatusListener
    googleDriveBoardServer: googleDriveBoardServer ?? {
      addEventListener: () => {},
      removeEventListener: () => {},
      flushSaveQueue: async () => {},
      dataPartTransformer: () => ({}),
    },
    fetchWithCreds: mock.fn(async () => new Response("{}", { status: 200 })),
    googleDriveClient: googleDriveClient ?? {},
    signinAdapter: signinAdapter ?? {},
    // Mock RunService that returns a testable mock runner
    runService: {
      createRunner: (config: {
        runner?: { nodes?: Array<{ id: string }> };
      }) => {
        const nodes = config?.runner?.nodes ?? [];
        const mockRunner = createMockRunner(nodes);
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
          nodeById: (id: string) => {
            const meta = nodeMetadata[id] ?? {};
            return {
              title: () => meta.title ?? id,
              currentDescribe: () => ({
                metadata: { icon: meta.icon, tags: meta.tags },
              }),
              currentPorts: () => ({
                inputs: { ports: [] },
                outputs: { ports: [] },
              }),
              // For async describe fallback - include tags to skip this branch
              describe: () =>
                Promise.resolve({
                  metadata: { icon: meta.icon, tags: meta.tags },
                }),
            };
          },
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
