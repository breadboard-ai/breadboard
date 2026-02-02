/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SCA Test Helpers - Shared mocks and fixtures
 *
 * This module re-exports all shared test utilities.
 * Import from here for convenience.
 */

// Fixtures
export { makeFreshGraph, makeTestProjectState } from "./fixtures.js";

// Controller mocks
export {
  makeTestController,
  makeMockSnackbarController,
  makeMockFlowgenInput,
  createMockEditor,
  flushEffects,
  type TestControllerOptions,
} from "./mock-controller.js";

// Services mocks
export {
  makeTestServices,
  makeTestGraphStoreWithEditor,
  createMockRunner,
  makeMockBoardServer,
  type TestServicesOptions,
} from "./mock-services.js";

import type { FlowGenerator } from "../../../src/ui/flow-gen/flow-generator.js";
import type { AppServices } from "../../../src/sca/services/services.js";
import { makeTestController } from "./mock-controller.js";
import {
  makeTestServices,
  makeTestGraphStoreWithEditor,
  type TestServicesOptions,
} from "./mock-services.js";

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
