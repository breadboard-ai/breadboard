/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { saveRunnerState } from "./serialization.js";
import { RunStack, TraversalResult } from "./types.js";

// TODO: Support stream serialization somehow.
// see https://github.com/breadboard-ai/breadboard/issues/423

export class StackManager {
  #stack: RunStack;
  #result?: TraversalResult;

  constructor(stack?: RunStack) {
    this.#stack = structuredClone(stack) || [];
  }

  onGraphStart(): void {
    this.#stack.push({ graph: 0, node: 0 });
    console.log("onGraphStart", structuredClone(this.#stack));
    // TODO: implement
  }

  onNodeStart(result: TraversalResult): void {
    this.#stack[this.#stack.length - 1].node++;
    this.#result = result;
    console.log("onNodeStart", structuredClone(this.#stack));
    // TODO: implement
  }

  onNodeEnd(): void {
    console.log("onNodeEnd", structuredClone(this.#stack));
    // TODO: implement
  }

  onGraphEnd(): void {
    console.log("onGraphEnd", structuredClone(this.#stack));
    // TODO: implement
  }

  async state(): Promise<RunStack> {
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
