/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mock } from "node:test";
import type { GraphDescriptor } from "@breadboard-ai/types";
import type { GuestConfiguration } from "@breadboard-ai/types/opal-shell-protocol.js";
import { AppServices } from "../../../src/sca/services/services.js";
import type { GlobalConfig } from "../../../src/ui/contexts/global-config.js";
import type { FlowGenerator } from "../../../src/ui/flow-gen/flow-generator.js";
import {
  makeTestGraphStore,
  loadGraphIntoStore,
} from "../../helpers/_graph-store.js";
import { editGraphStore } from "../../helpers/_editor.js";
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
  const graphStore = makeTestGraphStore();
  const testGraph: GraphDescriptor = { nodes: [], edges: [] };
  loadGraphIntoStore(graphStore, testGraph);
  const editor = editGraphStore(graphStore);
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
    // State map mirroring the orchestrator's per-node lifecycle state.
    // All nodes in a single stage default to "ready".
    state: new Map(
      nodes.map((n) => [n.id, { state: "ready" as const, stage: 0 }])
    ),
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
  flowGeneratorMock?: Partial<FlowGenerator>;
  googleDriveClient?: Partial<GoogleDriveClient>;
  signinAdapter?: Partial<SigninAdapter>;
  googleDriveBoardServer?: Partial<
    Omit<GoogleDriveBoardServer, "ops"> & {
      ops?: Partial<GoogleDriveBoardServer["ops"]>;
    }
  >;
  globalConfig?: Partial<GlobalConfig>;
  guestConfig?: Partial<GuestConfiguration>;
}

export function makeTestServices(options: TestServicesOptions = {}) {
  const {
    agentContext = defaultAgentContext,
    flowGeneratorMock,
    googleDriveClient,
    signinAdapter,
    googleDriveBoardServer,
    globalConfig = {},
    guestConfig = {},
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
    globalConfig,
    guestConfig,
    signinAdapter: signinAdapter ?? {},
    // Mock RunService that returns a testable mock runner and provides
    // a stable runnerEventBus for event triggers.
    runService: {
      runnerEventBus: new EventTarget(),
      createRunner: (config: {
        runner?: { nodes?: Array<{ id: string }> };
      }) => {
        const nodes = config?.runner?.nodes ?? [];
        const mockRunner = createMockRunner(nodes);
        const abortController = new AbortController();
        return { runner: mockRunner, abortController };
      },
      registerRunner: () => {},
      unregisterRunner: () => {},
    },
    // Mock loader for run actions
    loader: {} as unknown as AppServices["loader"],
    // Mock sandbox for run config
    sandbox: (() => {}) as unknown as AppServices["sandbox"],
    // Event bus for event-triggered actions
    stateEventBus: new EventTarget(),
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
