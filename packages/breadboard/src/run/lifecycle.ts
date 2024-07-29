/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState, saveRunnerState } from "../serialization.js";
import { MachineResult } from "../traversal/result.js";
import type { TraversalResult } from "../types.js";
import type { ManagedRunStateLifecycle, RunState } from "./types.js";

// TODO: Support stream serialization somehow.
// see https://github.com/breadboard-ai/breadboard/issues/423

export class LifecycleManager implements ManagedRunStateLifecycle {
  #stack: RunState;
  #result?: TraversalResult;

  constructor(stack: RunState) {
    this.#stack = stack;
  }

  dispatchGraphStart(url: string, invocationPath: number[]): void {
    this.#stack.push({ url, path: invocationPath });
  }

  dispatchSkip(): void {
    // TODO: implement
  }

  dispatchNodeStart(result: TraversalResult): void {
    this.#result = result;
  }

  dispatchNodeEnd(): void {
    // TODO: implement
  }

  dispatchGraphEnd(): void {
    // TODO: implement
  }

  async state(): Promise<RunState> {
    // Assemble the stack from existing pieces.
    const stack = structuredClone(this.#stack);
    if (this.#result) {
      stack[stack.length - 1].state = await saveRunnerState(
        "nodestart",
        this.#result
      );
    }
    return stack;
  }
}

export const traversalResultFromStack = (
  stack: RunState
): MachineResult | undefined => {
  const { state } = stack[stack.length - 1];
  return state ? loadRunnerState(state).state : undefined;
};
