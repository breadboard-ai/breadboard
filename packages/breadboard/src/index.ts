/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type * from "./types.js";

export { Board } from "./board.js";
export { BoardRunner } from "./runner.js";
export { Node } from "./node.js";
export { SchemaBuilder, combineSchemas } from "./schema.js";
export { RunResult } from "./run.js";
export { TraversalMachine } from "./traversal/machine.js";
export { MachineResult } from "./traversal/result.js";
export { traversalResultFromStack } from "./stack.js";
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
export { Runner } from "./new/runner/runner.js";
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
export { asyncGen } from "./utils/async-gen.js";

/**
 * The Inspector API.
 */
export type * from "./inspector/types.js";
export { inspect, createRunObserver } from "./inspector/index.js";
export { PortStatus } from "./inspector/types.js";

/**
 * The Editor API.
 */
export type * from "./editor/types.js";
export { editGraph as edit } from "./editor/graph.js";

/**
 * The Loader API
 */
export type * from "./loader/types.js";
export { createLoader } from "./loader/index.js";
