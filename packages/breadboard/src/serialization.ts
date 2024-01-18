/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TraversalMachine } from "./traversal/machine.js";
import { MachineResult } from "./traversal/result.js";
import { TraversalResult } from "./types.js";

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

export const saveRunnerState = async (
  type: string,
  result: TraversalResult
) => {
  const state = await TraversalMachine.prepareToSafe(result);
  return JSON.stringify({ state, type }, replacer);
};

export const loadRunnerState = (s: string) => {
  const { state: o, type } = JSON.parse(s, reviver);
  const state = MachineResult.fromObject(o);
  return { state, type };
};
