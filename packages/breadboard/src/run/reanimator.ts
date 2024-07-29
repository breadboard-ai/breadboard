/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ReanimationController,
  ReanimationFrame,
  ReanimationMode,
  ReplayResults,
  ResumeResults,
} from "./types.js";

export class Reanimator implements ReanimationController {
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
