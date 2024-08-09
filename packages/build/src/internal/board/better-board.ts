/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";
import type { OutputPort, OutputPortReference } from "../common/port.js";
import type {
  AutoOptional,
  Expand,
  RemoveReadonly,
} from "../common/type-util.js";
import type { Value } from "../common/value.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { Convergence } from "./converge.js";
import type { GenericSpecialInput, Input, InputWithDefault } from "./input.js";
import type { Loopback } from "./loopback.js";

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function board<const T extends BoardInit>(
  init: T
): BoardDefinition<
  Expand<AutoOptional<RemoveReadonly<SimplifyBoardInitInputs<T["inputs"]>>>>,
  Expand<AutoOptional<RemoveReadonly<SimplifyBoardInitOutputs<T["outputs"]>>>>
> {
  console.log({ init });
  return () => ({});
}

export interface BoardInit {
  inputs: InputNode | InputNode[] | AnonymousInputNodeShorthand;
  outputs: OutputNode | OutputNode[] | AnonymousOutputNodeShorthand;
}

type AnonymousInputNodeShorthand = Record<string, GenericSpecialInput>;

type AnonymousOutputNodeShorthand = Record<string, Value | undefined>;

export type BoardDefinition<
  I extends Record<string, JsonSerializable | undefined>,
  O extends Record<string, JsonSerializable | undefined>,
> = (inputs: {
  [K in keyof I]: Value<I[K]>;
}) => BoardInstance<I, O>;

export type BoardInstance<
  I extends Record<string, JsonSerializable | undefined>,
  O extends Record<string, JsonSerializable | undefined>,
> = {};

/**
 * Board inputs can either be an object (one input node) or an array of objects
 * (multiple input nodes). This function returns a union of types in the array
 * case.
 */
type SimplifyBoardInitInputs<T extends BoardInit["inputs"]> =
  T extends InputNode<infer X>
    ? X
    : T extends InputNode[]
      ? SimplifyBoardInitInputs<T[number]>
      : T extends AnonymousInputNodeShorthand
        ? ExtractInputTypes<T>
        : never;

/**
 */
type SimplifyBoardInitOutputs<T extends BoardInit["outputs"]> =
  T extends OutputNode<infer X>
    ? X
    : T extends OutputNode[]
      ? SimplifyBoardInitOutputs<T[number]>
      : T extends AnonymousOutputNodeShorthand
        ? ExtractOutputTypes<T>
        : never;

/**
 * Pulls out the type parameter for each `Input`, taking care to add `undefined`
 * in the case of `InputWithDefault`. This is because when there is a default,
 * then it is optional from the caller's perspective.
 */
type ExtractInputTypes<T extends Record<string, GenericSpecialInput>> = {
  [K in keyof T]: T[K] extends Input<infer X>
    ? X
    : T[K] extends InputWithDefault<infer X>
      ? X | undefined
      : never;
};

/**
 * Pulls out the type parameter for each `Input`, taking care to add `undefined`
 * in the case of `InputWithDefault`. This is because when there is a default,
 * then it is optional from the caller's perspective.
 */
type ExtractOutputTypes<T extends Record<string, Value | undefined>> = {
  [K in keyof T]: T[K] extends Input<infer X>
    ? X
    : T[K] extends InputWithDefault<infer X>
      ? X | undefined
      : T[K] extends
            | Loopback<infer X>
            | Convergence<infer X>
            | OutputPort<infer X>
            | OutputPortReference<infer X>
        ? X
        : never;
};

export function inputNode<T extends Record<string, GenericSpecialInput>>(
  inputs: T,
  metadata?: NodeMetadata & { id?: string }
): InputNode<ExtractInputTypes<T>> {
  return {} as InputNode<ExtractInputTypes<T>>;
}

export interface InputNode<
  T extends Record<string, JsonSerializable | undefined> = Record<
    string,
    JsonSerializable | undefined
  >,
> {
  // TODO(aomarks) Better branding
  isInputNode: true;
}

export function outputNode<T extends Record<string, Value | undefined>>(
  outputs: T,
  metadata?: NodeMetadata & { id?: string }
): OutputNode<ExtractOutputTypes<T>> {
  return {} as OutputNode<ExtractOutputTypes<T>>;
}

export interface OutputNode<
  T extends Record<string, JsonSerializable | undefined> = Record<
    string,
    JsonSerializable | undefined
  >,
> {
  // TODO(aomarks) Better branding
  isOutputNode: true;
}
