/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// An export for legacy runtime APIs: things that we need exposed
// but really don't want to in the long run

// Move to `invoke` (or something) package.
export { describerResultToNodeHandlerMetadata } from "./graph-based-node-handler.js";
// Move to `invoke` (or something) package.
export {
  getGraphHandlerFromMutableGraph,
  getHandler,
  getGraphHandler,
} from "./handler.js";
export { invokeGraph } from "./run/invoke-graph.js";
// Move `GraphDescriberManager` to `runtime` package
export { CapabilitiesManagerImpl } from "./sandbox/capabilities-manager.js";
// Move `GraphDescriberManager` to `runtime` package
export {
  invokeDescriber,
  invokeMainDescriber,
} from "./sandbox/invoke-describer.js";
// Leave as is?
export { GraphRepresentationImpl } from "./traversal/representation.js";
