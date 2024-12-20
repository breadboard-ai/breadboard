/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Clock } from "../../../util/clock-type.js";

/**
 * Starts at 1000 and must be ticked manually.
 */
export class FakeClock implements Clock {
  #now = 1000;

  now() {
    return this.#now;
  }

  tick() {
    this.#now++;
  }
}
