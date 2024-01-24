/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState, saveRunnerState } from "./serialization.js";
import { MachineResult } from "./traversal/result.js";
import { RunState, TraversalResult } from "./types.js";

// TODO: Support stream serialization somehow.
// see https://github.com/breadboard-ai/breadboard/issues/423

export class StackManager {
  #stack: RunState;
  #result?: TraversalResult;

  constructor(stack?: RunState) {
    this.#stack = structuredClone(stack) || [];
  }

  onGraphStart(): void {
    this.#stack.push({ graph: 0, node: 0 });
  }

  onNodeStart(result: TraversalResult): void {
    this.#stack[this.#stack.length - 1].node++;
    this.#result = result;
  }

  onNodeEnd(): void {
    // TODO: implement
  }

  onGraphEnd(): void {
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
