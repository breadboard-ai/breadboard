/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState, saveRunnerState } from "../serialization.js";
import { MachineResult } from "../traversal/result.js";
import type {
  Edge,
  NodeIdentifier,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";
import { Registry } from "./registry.js";
import type {
  LifecyclePathRegistryEntry,
  ManagedRunStateLifecycle,
  ReanimationState,
  ReanimationStateCache,
  ReanimationStateVisits,
  RunStackEntry,
  RunState,
} from "@breadboard-ai/types";
import { VisitTracker } from "./visit-tracker.js";

// TODO: Support stream serialization somehow.
// see https://github.com/breadboard-ai/breadboard/issues/423

function toReanimationState(
  root: LifecyclePathRegistryEntry<RunStackEntry>,
  visits: VisitTracker
): ReanimationState {
  function pathToString(path: number[]): string {
    return path.join("-");
  }

  function descend(
    entry: LifecyclePathRegistryEntry<RunStackEntry>,
    path: number[],
    result: ReanimationStateCache
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

  const states: ReanimationStateCache = {};
  descend(root, [], states);
  return { states, visits: visits.visited() };
}

export class LifecycleManager implements ManagedRunStateLifecycle {
  #stack: RunState;
  #registry: Registry<RunStackEntry>;
  #visits: VisitTracker;

  constructor(visits?: ReanimationStateVisits) {
    this.#stack = [];
    this.#registry = new Registry<RunStackEntry>();
    this.#visits = new VisitTracker(visits);
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
    state.state = saveRunnerState("nodestart", unpackedState);
  }

  dispatchGraphStart(url: string, path: number[]): void {
    const entry = this.#registry.create(path);
    if (entry) {
      entry.data = { ...entry.data, url, path };
    }
    this.#stack.push({ url, path });
  }

  dispatchSkip(): void {
    // Do nothing for now.
  }

  dispatchEdge(_edge: Edge): void {
    // Do nothing for now.
  }

  async dispatchNodeStart(
    result: TraversalResult,
    invocationPath: number[]
  ): Promise<void> {
    this.#visits.visit(result.descriptor.id, invocationPath);
    if (this.#stack.length === 0) {
      return;
    }
    const entry = this.#registry.create(invocationPath);
    const state = saveRunnerState("nodestart", result);
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

  pathFor(node: NodeIdentifier): number[] | undefined {
    return this.#visits.pathFor(node);
  }

  state(): RunState {
    return this.#stack;
  }

  reanimationState(): ReanimationState {
    return toReanimationState(this.#registry.root, this.#visits);
  }
}

export const traversalResultFromStack = (
  stack: RunState
): MachineResult | undefined => {
  const { state } = stack[stack.length - 1];
  return state ? loadRunnerState(state).state : undefined;
};
