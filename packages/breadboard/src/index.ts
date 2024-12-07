/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type * from "./types.js";

export { Board } from "./board.js";
export { Node } from "./node.js";
export { SchemaBuilder, combineSchemas } from "./schema.js";
export { RunResult } from "./run.js";
export { TraversalMachine } from "./traversal/machine.js";
export { MachineResult } from "./traversal/result.js";
export { traversalResultFromStack } from "./run/lifecycle.js";
export { toMermaid } from "./mermaid.js";
export { callHandler } from "./handler.js";
export { asRuntimeKit } from "./kits/ctors.js";
export {
  StreamCapability,
  isStreamCapability,
  patchReadableStream,
  streamFromAsyncGen,
  clone,
  type StreamCapabilityType,
  type PatchedReadableStream,
} from "./stream.js";

// New Syntax:
export {
  board,
  // TODO Alias for easier migration to the new name. Remove in a future breaking change.
  board as recipe,
  code,
} from "./new/grammar/board.js";
export { addKit } from "./new/grammar/kits.js";
export { base } from "./new/grammar/base.js";
export type {
  NodeValue as NewNodeValue,
  InputValues as NewInputValues,
  OutputValues as NewOutputValues,
  Serializeable,
  AbstractNode,
} from "./new/runner/types.js";
export type {
  Lambda,
  InputsForHandler,
  InputsForGraphDeclaration,
  OutputsForGraphDeclaration,
  NodeFactory as NewNodeFactory,
  NodeProxy as __NodeProxy,
  InputsMaybeAsValues,
  OutputsMaybeAsValues,
  OutputValuesOrUnknown,
  ProjectBackToOutputValues as __ProjectBackToOutputValues,
  InputValues as NewInputValuesWithNodeFactory,
  AbstractValue as V,
} from "./new/grammar/types.js";
export { hash } from "./utils/hash.js";
export { asyncGen } from "./utils/async-gen.js";
export { Throttler } from "./utils/throttler.js";
export { type SemVer, SemanticVersioning } from "./utils/semver.js";
export type * from "./utils/typed-event-target.js";

/**
 * Helpers for handling BreadboardCapability.
 */
export {
  getGraphDescriptor,
  isGraphDescriptorCapability,
  isResolvedURLBoardCapability,
  isUnresolvedPathBoardCapability,
} from "./capability.js";

/**
 * The Inspector API.
 */
export * from "./inspector/types.js";
export {
  inspect,
  createRunObserver,
  createGraphStore,
} from "./inspector/index.js";
export { PortStatus } from "./inspector/types.js";

/**
 * The Editor API.
 */
export type * from "./editor/types.js";
export { blank, blankLLMContent } from "./editor/index.js";

/**
 * The Loader API
 */
export type * from "./loader/types.js";
export { createLoader } from "./loader/index.js";

export { formatGraphDescriptor } from "./formatter.js";

/**
 * DataCapability helpers.
 */
export type * from "./data/types.js";
export {
  asBase64,
  asBlob,
  deflateData,
  inflateData,
  isDataCapability,
  isInlineData,
  isStoredData,
  isSerializedData,
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isLLMContent,
  isLLMContentArray,
  isMetadataEntry,
  isTextCapabilityPart,
  toInlineDataPart,
  toStoredDataPart,
  createDefaultDataStore,
  createDefaultRunStore,
} from "./data/index.js";

/**
 * Managed Run State API
 */
export type * from "./run/types.js";
export { createRunStateManager } from "./run/index.js";
export { invokeGraph } from "./run/invoke-graph.js";
export { runGraph } from "./run/run-graph.js";

/**
 * Conversion helpers
 */
export { sequenceEntryToHarnessRunResult } from "./inspector/run/conversions.js";

export { addSandboxedRunModule } from "./sandboxed-run-module.js";
export {
  blankImperative,
  defaultModuleContent,
} from "./run/run-imperative-graph.js";

export { IsolateSelectionTransform } from "./editor/transforms/isolate-selection.js";
export { MoveToGraphTransform } from "./editor/transforms/move-to-graph.js";
export { MoveToNewGraphTransform } from "./editor/transforms/move-to-new-graph.js";
export { MergeGraphTransform } from "./editor/transforms/merge-graph.js";
export { ConfigureSidewireTransform } from "./editor/transforms/configure-sidewire.js";
export { SidewireToNewGraphTransform } from "./editor/transforms/sidewire-to-new-graph.js";
