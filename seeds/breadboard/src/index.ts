/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { Board } from "./board.js";
export { BoardRunner } from "./runner.js";
export { Node } from "./node.js";
export { SchemaBuilder } from "./schema.js";
export { LogProbe } from "./log.js";
export { DebugProbe } from "./debug.js";
export { RunResult } from "./run.js";
export type {
  Edge,
  GraphMetadata,
  GraphDescriptor,
  NodeConfiguration,
  NodeDescriptor,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeHandler,
  NodeHandlerFunction,
  InputValues,
  OutputValues,
  NodeHandlers,
  NodeIdentifier,
  NodeTypeIdentifier,
  KitDescriptor,
  KitReference,
  NodeValue,
  Capability,
  ErrorCapability,
  TraversalResult,
  SubGraphs,
  ProbeEvent,
  Schema,
  Kit,
  NodeFactory,
  BreadboardValidator,
  BreadboardValidatorMetadata,
  BreadboardSlotSpec,
  BreadboardNode,
  BreadboardCapability,
  BreadboardRunner,
  BreadboardRunResult,
  NodeHandlerContext,
  OptionalIdConfiguration,
  NodeConfigurationConstructor,
  LambdaFunction,
  LambdaNodeInputs,
  ConfigOrLambda,
  RunResultType,
  KitConstructor,
  GenericKit,
  LambdaNodeOutputs,
} from "./types.js";
export { TraversalMachine } from "./traversal/machine.js";
export { MachineResult } from "./traversal/result.js";
export { toMermaid } from "./mermaid.js";
export { callHandler } from "./handler.js";
export { asRuntimeKit } from "./kits/ctors.js";
export {
  StreamCapability,
  isStreamCapability,
  patchReadableStream,
  streamFromAsyncGen,
  type StreamCapabilityType,
  type PatchedReadableStream,
} from "./stream.js";

// New Syntax:
export { Runner } from "./new/runner/runner.js";
export {
  recipe,
  recipeAsGraph,
  recipeAsCode,
  recipeAsGraphWithZod,
  recipeAsCodeWithZod,
} from "./new/recipe-grammar/recipe.js";
export { addKit } from "./new/recipe-grammar/kits.js";
export { base } from "./new/recipe-grammar/base.js";
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
} from "./new/recipe-grammar/types.js";
export { asyncGen } from "./utils/async-gen.js";
