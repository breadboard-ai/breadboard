/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type * from "./types.js";

export { Board } from "./board.js";
export { callHandler } from "./handler.js";
export { asRuntimeKit } from "./kits/ctors.js";
export { toMermaid } from "./mermaid.js";
export { Node } from "./node.js";
export { RunResult } from "./run.js";
export { traversalResultFromStack } from "./run/lifecycle.js";
export { combineSchemas, SchemaBuilder } from "./schema.js";
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

// New Syntax:
export { base } from "./new/grammar/base.js";
export {
  board,
  code,
  // TODO Alias for easier migration to the new name. Remove in a future breaking change.
  board as recipe,
} from "./new/grammar/board.js";
export { addKit } from "./new/grammar/kits.js";
export type {
  NodeProxy as __NodeProxy,
  ProjectBackToOutputValues as __ProjectBackToOutputValues,
  InputsForGraphDeclaration,
  InputsForHandler,
  InputsMaybeAsValues,
  Lambda,
  InputValues as NewInputValuesWithNodeFactory,
  NodeFactory as NewNodeFactory,
  OutputsForGraphDeclaration,
  OutputsMaybeAsValues,
  OutputValuesOrUnknown,
  AbstractValue as V,
} from "./new/grammar/types.js";
export type {
  AbstractNode,
  InputValues as NewInputValues,
  NodeValue as NewNodeValue,
  OutputValues as NewOutputValues,
  Serializeable,
} from "./new/runner/types.js";
export { asyncGen } from "./utils/async-gen.js";
export { hash } from "./utils/hash.js";
export { relativePath } from "./utils/relative-path.js";
export { SemanticVersioning, type SemVer } from "./utils/semver.js";
export type * from "./utils/template.js";
export { Template } from "./utils/template.js";
export { Throttler } from "./utils/throttler.js";
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
export {
  createGraphStore,
  createRunObserver,
  inspect,
} from "./inspector/index.js";
export * from "./inspector/types.js";
export { PortStatus } from "./inspector/types.js";

/**
 * The Editor API.
 */
export { blank, blankLLMContent } from "./editor/index.js";
export type * from "./editor/types.js";

/**
 * The Loader API
 */
export { createLoader } from "./loader/index.js";
export type * from "./loader/types.js";

export { formatGraphDescriptor } from "./formatter.js";

/**
 * DataCapability helpers.
 */
export {
  asBase64,
  asBlob,
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
  convertStoredPartsToAbsoluteUrls,
  createDefaultDataStore,
  createDefaultRunStore,
  createEphemeralBlobStore,
  createFileSystem,
  writablePathFromString,
  deflateData,
  inflateData,
  transformContents,
  isDataCapability,
  isFileDataCapabilityPart,
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isImageURL,
  isInlineData,
  isJSONPart,
  isListPart,
  isLLMContent,
  isLLMContentArray,
  isMetadataEntry,
  isSerializedData,
  isStoredData,
  isTextCapabilityPart,
  StubFileSystem,
  toInlineDataPart,
  toStoredDataPart,
  transformBlobs,
  transformDataParts,
} from "./data/index.js";
export type * from "./data/types.js";

export { err, ok } from "./data/file-system/utils.js";

/**
 * Managed Run State API
 */
export { createRunStateManager } from "./run/index.js";
export { invokeGraph } from "./run/invoke-graph.js";
export { runGraph } from "./run/run-graph.js";
export type * from "./run/types.js";

/**
 * Conversion helpers
 */
export { sequenceEntryToHarnessRunResult } from "./inspector/run/conversions.js";

export {
  blankImperative,
  defaultModuleContent,
} from "./run/run-imperative-graph.js";
export { addSandboxedRunModule } from "./sandboxed-run-module.js";

export { ConfigureSidewireTransform } from "./editor/transforms/configure-sidewire.js";
export { IsolateSelectionTransform } from "./editor/transforms/isolate-selection.js";
export { MergeGraphTransform } from "./editor/transforms/merge-graph.js";
export { MoveToGraphTransform } from "./editor/transforms/move-to-graph.js";
export { MoveToNewGraphTransform } from "./editor/transforms/move-to-new-graph.js";
export { SidewireToNewGraphTransform } from "./editor/transforms/sidewire-to-new-graph.js";
