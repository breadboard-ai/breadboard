/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type IntervalId = NodeJS.Timeout;
const activeIntervals: Set<IntervalId> = new Set();

export { autoClearingInterval };

const originalSetInterval = globalThis.setInterval;
const orignalClearInterval = globalThis.clearInterval;

const autoClearingInterval = {
  setInterval(
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ): IntervalId {
    const intervalId = originalSetInterval(callback, delay, ...args);
    activeIntervals.add(intervalId);
    return intervalId;
  },

  clearAllIntervals(): void {
    for (const intervalId of activeIntervals) {
      orignalClearInterval(intervalId);
    }
    activeIntervals.clear();
  },
};
