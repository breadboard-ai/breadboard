/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState } from "../serialization.js";
import {
  ReanimationController,
  ReanimationFrame,
  ReanimationFrameController,
  ReanimationInputs,
  ReanimationMode,
  ReanimationState,
  ReplayResults,
  ResumeResults,
} from "./types.js";

const pathMatches = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

export class Reanimator implements ReanimationController {
  #resumeFrom: ReanimationState;
  #inputs?: ReanimationInputs;

  constructor(resumeFrom: ReanimationState, inputs?: ReanimationInputs) {
    this.#resumeFrom = resumeFrom;
    this.#inputs = inputs;
  }

  #supplyInputs(invocationPath: number[]): boolean {
    if (!this.#inputs) {
      return false;
    }
    const inputsPath = this.#inputs.invocationPath.slice(0, -1);
    return pathMatches(invocationPath, inputsPath);
  }

  enter(invocationPath: number[]): ReanimationFrameController {
    const stackEntry = this.#resumeFrom[invocationPath.join("-")];
    if (!stackEntry) {
      return new FrameReanimator(undefined);
    }
    if (!stackEntry || !stackEntry.state) {
      throw new Error("Cannot reanimate without a state");
    }
    const result = loadRunnerState(stackEntry.state).state;
    if (this.#supplyInputs(invocationPath)) {
      result.outputsPromise = Promise.resolve({
        ...this.#inputs?.inputs,
        ...result.partialOutputs,
      });
      this.#inputs = undefined;
    }
    const replayOutputs = stackEntry.outputs ? [stackEntry.outputs] : [];

    // Always return the new instance:
    // wraps the actual ReanimationFrame, if any.
    return new FrameReanimator({
      result,
      invocationPath: stackEntry.path,
      replayOutputs,
    });
  }
}

export class FrameReanimator implements ReanimationFrameController {
  #frame: ReanimationFrame | undefined;

  constructor(frame: ReanimationFrame | undefined) {
    this.#frame = frame;
  }

  mode(): ReanimationMode {
    if (!this.#frame) {
      return "none";
    }
    if (this.#frame.replayOutputs.length > 0) {
      return "replay";
    }
    return "resume";
  }

  replay(): ReplayResults {
    if (!this.#frame) {
      throw new Error("Cannot replay without a frame");
    }
    if (this.#frame.replayOutputs.length === 0) {
      throw new Error("Cannot replay without replayOutputs");
    }
    const result = this.#frame.result;
    // Mutates replayOutputs. This is intentional.
    result.inputs = this.#frame.replayOutputs.shift()!;
    const path = this.#frame.invocationPath;
    const invocationId = path[path.length - 1];

    return { result, invocationId, path };
  }

  resume(): ResumeResults {
    if (!this.#frame) {
      throw new Error("Cannot resume without a frame");
    }
    const invocationPath = this.#frame.invocationPath;
    const result = this.#frame.result;

    return { invocationPath, result };
  }
}
