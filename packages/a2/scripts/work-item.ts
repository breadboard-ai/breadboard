/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvalHarness } from "../src/eval-harness";
import { Surface } from "./surface";
import { time, timeEnd } from "./time";

export { WorkItem };

class WorkItem {
  #uuid = "";
  #duration = 0;
  #result: unknown = null;

  async run(
    type: "ui" | "data",
    harness: EvalHarness,
    surface: Surface,
    task: (harness: EvalHarness, surface: Surface) => Promise<unknown>,
    emit = { result: false, time: false }
  ) {
    this.#uuid = `${surface.surfaceId}-${type}`;
    time(this.#uuid);

    this.#result = await task(harness, surface);
    this.#duration = timeEnd(this.#uuid);

    if (emit.time) {
      console.log(`${this.#uuid}: ${this.#duration.toFixed(2)}ms`);
    }

    if (emit.result) {
      console.log(this.#result);
    }

    return this;
  }

  get uuid() {
    return this.#uuid;
  }

  get duration() {
    return `${this.#duration.toFixed(2)}ms`;
  }

  get result() {
    if (this.#result === null)
      throw new Error("Attempted to access result early");
    return this.#result;
  }
}
