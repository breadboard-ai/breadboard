/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  ReanimationController,
  ReanimationFrame,
  ReanimationFrameController,
  ReanimationMode,
  ReanimationState,
  ReplayResults,
  ResumeResults,
} from "@breadboard-ai/types";
import { loadRunnerState } from "../serialization.js";

export class Reanimator implements ReanimationController {
  #resumeFrom: ReanimationState;
  #inputs?: InputValues;

  constructor(resumeFrom: ReanimationState, inputs?: InputValues) {
    this.#resumeFrom = resumeFrom;
    this.#inputs = inputs;
  }

  enter(invocationPath: number[]): ReanimationFrameController {
    const entryId = invocationPath.join("-");
    const cache = this.#resumeFrom.states;
    const entry = cache?.[entryId];
    if (!entry) {
      return new FrameReanimator(undefined);
    }
    if (!entry || !entry.state) {
      throw new Error("Cannot reanimate without a state");
    }
    const result = loadRunnerState(entry.state).state;
    result.outputs = {
      ...this.#inputs,
      ...result.partialOutputs,
    };
    this.#inputs = undefined;
    if (this.#resumeFrom.nodeConfig) {
      result.inputs = { ...result.inputs, ...this.#resumeFrom.nodeConfig };
    }
    const replayOutputs = entry.outputs ? [entry.outputs] : [];

    // Always return the new instance:
    // wraps the actual ReanimationFrame, if any.
    return new FrameReanimator({
      result,
      invocationPath: entry.path,
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
