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

  constructor(stack: RunState) {
    this.#stack = stack;
  }
  complete(): boolean {
    return false;
  }

  dispatchGraphStart(url: string, path: number[]): void {
    this.#stack.push({ url, path });
    console.log(
      "🌻 dispatchGraphStart",
      url,
      "stack size:",
      this.#stack.length,
      "path:",
      path
    );
  }

  dispatchSkip(): void {
    // TODO: implement
  }

  async dispatchNodeStart(
    result: TraversalResult,
    invocationPath: number[]
  ): Promise<void> {
    const last = this.#stack[this.#stack.length - 1];
    if (last) {
      last.state = await saveRunnerState("nodestart", result);
      last.path = invocationPath;
    }
  }

  dispatchNodeEnd(): void {
    // TODO: implement
  }

  dispatchGraphEnd(): void {
    // TODO: implement
  }

  state(): RunState {
    return this.#stack;
  }
}

export const traversalResultFromStack = (
  stack: RunState
): MachineResult | undefined => {
  const { state } = stack[stack.length - 1];
  return state ? loadRunnerState(state).state : undefined;
};
