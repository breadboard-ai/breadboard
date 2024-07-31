/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState } from "../serialization.js";
import { InputValues } from "../types.js";
import {
  ReanimationController,
  ReanimationFrame,
  ReanimationFrameController,
  ReanimationMode,
  ReplayResults,
  ResumeResults,
  RunState,
} from "./types.js";

export class Reanimator implements ReanimationController {
  #resumeFrom: RunState;
  #inputs?: InputValues;

  constructor(resumeFrom: RunState, inputs?: InputValues) {
    this.#resumeFrom = resumeFrom;
    this.#inputs = inputs;
  }

  enter(): ReanimationFrameController {
    if (this.#resumeFrom.length === 0) {
      return new FrameReanimator(undefined);
    }
    const stackEntry = this.#resumeFrom.shift();
    if (!stackEntry || !stackEntry.state) {
      throw new Error("Cannot reanimate without a state");
    }
    const result = loadRunnerState(stackEntry.state).state;
    if (this.#inputs && this.#resumeFrom.length === 0) {
      result.outputsPromise = Promise.resolve({
        ...this.#inputs,
        ...result.partialOutputs,
      });
      this.#inputs = undefined;
    }

    // Always return the new instance:
    // wraps the actual ReanimationFrame, if any.
    return new FrameReanimator({
      result,
      invocationPath: stackEntry.path,
      replayOutputs: [],
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
