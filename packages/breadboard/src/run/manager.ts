/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState } from "../serialization.js";
import { InputValues } from "../types.js";
import { LifecycleManager } from "./lifecycle.js";
import { Reanimator } from "./reanimator.js";
import type {
  ManagedRunState,
  ReanimationController,
  RunState,
} from "./types.js";

export class RunStateManager implements ManagedRunState {
  #resumeFrom: RunState;
  #lifecycle: LifecycleManager;
  #inputs?: InputValues;

  constructor(resumeFrom: RunState, inputs?: InputValues) {
    this.#resumeFrom = resumeFrom;
    this.#lifecycle = new LifecycleManager([]);
    this.#inputs = inputs;
  }

  lifecycle() {
    // TODO: Lifecycle during reanimation should be doing
    // nothing, since we're reconstructing the state of
    // the run from a previously saved state.
    return this.#lifecycle;
  }

  reanimation(): ReanimationController {
    if (this.#resumeFrom.length === 0) {
      return new Reanimator(undefined);
    }
    const stackEntry = this.#resumeFrom[this.#resumeFrom.length - 1];
    if (!stackEntry.state) {
      throw new Error("Cannot reanimate without a state");
    }
    const result = loadRunnerState(stackEntry.state).state;
    if (this.#inputs) {
      result.outputsPromise = Promise.resolve(this.#inputs);
      this.#inputs = undefined;
    }

    // Always return the new instance:
    // wraps the actual ReanimationFrame, if any.
    return new Reanimator({
      result,
      invocationPath: stackEntry.path,
      replayOutputs: [],
    });
  }
}
