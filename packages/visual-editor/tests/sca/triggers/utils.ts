/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Trigger test utilities.
 *
 * This file re-exports shared helpers from the central helpers module.
 * For new tests, prefer importing directly from "../helpers/index.js".
 */

// Re-export everything from the shared helpers
export {
  // Fixtures
  makeFreshGraph,
  makeTestProjectState,
  // Controller mocks
  makeTestController,
  makeMockFlowgenInput,
  createMockEditor,
  flushEffects,
  type TestControllerOptions,
  // Services mocks
  makeTestServices,
  makeTestGraphStoreWithEditor,
  createMockRunner,
  type TestServicesOptions,
  // Combined fixtures
  makeTestFixtures,
  type TestFixturesOptions,
} from "../helpers/index.js";

// Alias for backward compatibility
export { makeFreshGraph as makeTestGraph } from "../helpers/index.js";
