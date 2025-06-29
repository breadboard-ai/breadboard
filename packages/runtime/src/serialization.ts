/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MachineResult } from "./traversal/result.js";
import { MachineEdgeState } from "./traversal/state.js";
import type { TraversalResult } from "@breadboard-ai/types";

export const replacer = (key: string, value: unknown) => {
  if (!(value instanceof Map)) return value;
  return { $type: "Map", value: Array.from(value.entries()) };
};

export const reviver = (
  key: string,
  value: unknown & {
    $type?: string;
    value: Iterable<readonly [string, unknown]>;
  }
) => {
  const { $type } = (value || {}) as { $type?: string };
  return $type == "Map" && value.value
    ? new Map<string, unknown>(value.value)
    : value;
};

export const saveRunnerState = (type: string, result: TraversalResult) => {
  const state = result;
  return JSON.stringify({ state, type }, replacer);
};

export const loadRunnerState = (s: string) => {
  const { state: o, type } = JSON.parse(s, reviver);
  const state = MachineResult.fromObject(o);
  return { state, type };
};

export const cloneState = (result: TraversalResult): TraversalResult => {
  const {
    descriptor,
    inputs,
    missingInputs,
    current,
    opportunities,
    newOpportunities,
    state,
    outputs,
    partialOutputs,
  } = result;
  const clonedValueState = new MachineEdgeState();
  clonedValueState.constants = structuredClone(state.constants);
  clonedValueState.state = structuredClone(state.state);
  const clone = new MachineResult(
    descriptor,
    inputs,
    [...missingInputs],
    current,
    [...opportunities],
    [...newOpportunities],
    clonedValueState,
    partialOutputs
  );
  clone.outputs = outputs;
  return clone;
};
