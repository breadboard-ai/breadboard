/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExponentialBackoffParameters {
  budget: number;
  minDelay: number;
  maxDelay: number;
  multiplier: number;
  jitter?: number;
}

/**
 * Generates millisecond delay intervals for exponential backoff for use in
 * retry logic.
 */
export function* exponentialBackoff(
  params: ExponentialBackoffParameters
): Generator<number> {
  let total = 0;
  for (let attempt = 0; ; attempt++) {
    if (total >= params.budget) {
      return;
    }
    const base = params.minDelay * params.multiplier ** attempt;
    const jitter = params.jitter
      ? base * params.jitter * randomBetweenPlusAndMinusOne()
      : 0;
    const adjusted = Math.min(params.maxDelay, Math.max(0, base + jitter));
    yield adjusted;
    total += adjusted;
  }
}

function randomBetweenPlusAndMinusOne() {
  return Math.random() * 2 - 1;
}
