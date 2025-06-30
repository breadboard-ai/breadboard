/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// An export for legacy runtime APIs: things that we need exposed
// but really don't want to in the long run

export { createDefaultDataStore, createDefaultRunStore } from "./data/index.js";
export {
  remapData,
  deflateData,
  inflateData,
  purgeStoredDataInMemoryValues,
  transformContents,
} from "./data/inflate-deflate.js";
export { describerResultToNodeHandlerMetadata } from "./graph-based-node-handler.js";
export {
  callHandler,
  getGraphHandlerFromMutableGraph,
  getHandler,
  getGraphHandler,
} from "./handler.js";
export { invokeGraph } from "./run/invoke-graph.js";
export { runGraph } from "./run/run-graph.js";
export { LifecycleManager } from "./run/lifecycle.js";
export { ParameterManager } from "./run/parameter-manager.js";
export {
  isImperativeGraph,
  toImperativeGraph,
  toDeclarativeGraph,
} from "./run/run-imperative-graph.js";
export { CapabilitiesManagerImpl } from "./sandbox/capabilities-manager.js";
export {
  invokeDescriber,
  invokeMainDescriber,
} from "./sandbox/invoke-describer.js";
export { GraphRepresentationImpl } from "./traversal/representation.js";
export { RunResult } from "./run.js";
export {
  clone,
  isStreamCapability,
  patchReadableStream,
  StreamCapability,
  streamFromAsyncGen,
  type PatchedReadableStream,
  type StreamCapabilityType,
} from "./stream.js";
export { TraversalMachine } from "./traversal/machine.js";
export { MachineResult } from "./traversal/result.js";
export {
  getGraphDescriptor,
  isGraphDescriptorCapability,
  isResolvedURLBoardCapability,
  isUnresolvedPathBoardCapability,
} from "./capability.js";
export { createRunStateManager } from "./run/index.js";
export {
  blankImperative,
  defaultModuleContent,
} from "./run/run-imperative-graph.js";
export { LocalRunner } from "./harness/local-runner.js";
export { RemoteRunner } from "./harness/remote-runner.js";
export { loadRunnerState } from "./serialization.js";
export { handleRunGraphRequest } from "./remote/run-graph-server.js";

export {
  ProxyServer,
  HTTPServerTransport,
  type ProxyServerConfig,
} from "./remote/index.js";
export type { ServerResponse } from "./remote/http.js";
export { visitGraphNodes } from "./data/index.js";
export { run } from "./harness/index.js";
export type { AllowFilterFunction } from "./remote/config.js";
export { hasOrigin } from "./remote/index.js";
export { chunkRepairTransform } from "./remote/chunk-repair.js";
