/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState, saveRunnerState } from "../serialization.js";
import { MachineResult } from "../traversal/result.js";
import type { OutputValues, TraversalResult } from "../types.js";
import { Registry } from "./registry.js";
import type {
  LifecyclePathRegistryEntry,
  ManagedRunStateLifecycle,
  ReanimationState,
  RunStackEntry,
  RunState,
} from "./types.js";

// TODO: Support stream serialization somehow.
// see https://github.com/breadboard-ai/breadboard/issues/423

function toReanimationState(
  root: LifecyclePathRegistryEntry<RunStackEntry>
): ReanimationState {
  function pathToString(path: number[]): string {
    return path.join("-");
  }

  function descend(
    entry: LifecyclePathRegistryEntry<RunStackEntry>,
    path: number[],
    result: ReanimationState
  ) {
    for (const [index, child] of entry.children.entries()) {
      if (!child) continue;
      const newPath = [...path, index];
      if (child.data) {
        result[pathToString(path)] = child.data;
      }
      descend(child, newPath, result);
    }
  }

  const state: ReanimationState = {};
  descend(root, [], state);
  return state;
}

export class LifecycleManager implements ManagedRunStateLifecycle {
  #stack: RunState;
  #registry: Registry<RunStackEntry>;

  constructor(stack: RunState) {
    this.#stack = stack;
    this.#registry = new Registry<RunStackEntry>();
  }

  async supplyPartialOutputs(
    outputs: OutputValues,
    invocationPath: number[]
  ): Promise<void> {
    const state = this.#registry.find(invocationPath)?.data;
    if (!state) {
      console.warn(
        `No state found for path ${invocationPath}, partialOutputs will be dropped`
      );
      return;
    }
    const unpackedState = loadRunnerState(state.state!).state;
    unpackedState.partialOutputs = outputs;
    state.state = await saveRunnerState("nodestart", unpackedState);
  }

  dispatchGraphStart(url: string, path: number[]): void {
    const entry = this.#registry.create(path);
    if (entry) {
      entry.data = { ...entry.data, url, path };
    }
    this.#stack.push({ url, path });
  }

  dispatchSkip(): void {
    // TODO: implement
  }

  async dispatchNodeStart(
    result: TraversalResult,
    invocationPath: number[]
  ): Promise<void> {
    if (this.#stack.length === 0) {
      return;
    }
    const entry = this.#registry.create(invocationPath);
    const state = await saveRunnerState("nodestart", result);
    const last = this.#stack[this.#stack.length - 1];
    if (last) {
      last.state = state;
      last.path = invocationPath;
    }
    entry.data = { url: undefined, state, path: invocationPath };
  }

  dispatchNodeEnd(outputs: OutputValues, invocationPath: number[]): void {
    const entry = this.#registry.find(invocationPath);
    if (entry?.data) {
      entry.data.outputs = outputs;
    }
  }

  dispatchGraphEnd(): void {
    // TODO: implement
  }

  state(): RunState {
    return this.#stack;
  }

  reanimationState(): ReanimationState {
    return toReanimationState(this.#registry.root);
  }
}

export const traversalResultFromStack = (
  stack: RunState
): MachineResult | undefined => {
  const { state } = stack[stack.length - 1];
  return state ? loadRunnerState(state).state : undefined;
};
