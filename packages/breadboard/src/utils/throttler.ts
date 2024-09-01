/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type AsyncFunction<T extends unknown[], R> = (...args: T) => Promise<R>;

/**
 * A throttler that caches the result of a function call for a given delay.
 * If the function is called again within the delay, the cached result is
 * returned instead of calling the function again.
 *
 * This is useful for functions that are called frequently, but where the
 * result doesn't need to be up-to-date on every call.
 *
 * To use, create a new Throttler with the function you want to throttle,
 * then call the `call` method with the arguments you want to pass to the
 * function. The first time `call` is called, the function will be called
 * with the arguments. Subsequent calls within the delay will return the
 * cached result.
 */
export class Throttler<T extends unknown[], R> {
  private fn: AsyncFunction<T, R>;
  private delay: number;
  private lastCall: number = 0;
  private cachedResult: R | null = null;
  private inFlight: Promise<R> | null = null;

  constructor(fn: AsyncFunction<T, R>, delay: number = 5000) {
    this.fn = fn;
    this.delay = delay;
  }

  async call(thisObj: object, ...args: T): Promise<R> {
    const now = Date.now();
    // If there's an in-flight request, wait for it.
    if (this.inFlight) {
      if (this.cachedResult !== null) {
        return this.cachedResult;
      }
      return this.inFlight;
    }

    // If we have a cached result and we're within the delay,
    // return the cached result.
    if (this.cachedResult !== null && now - this.lastCall < this.delay) {
      return this.cachedResult;
    }

    // Otherwise, call the function.
    this.lastCall = now;
    this.inFlight = this.fn.apply(thisObj, args);

    this.inFlight
      .then((result) => {
        this.cachedResult = result;
        this.inFlight = null;
      })
      .catch(() => {
        this.inFlight = null;
      });

    return this.cachedResult || this.inFlight;
  }

  getCachedResult(): R | null {
    return this.cachedResult;
  }

  clearCache(): void {
    this.cachedResult = null;
    this.lastCall = 0;
  }

  setDelay(delay: number): void {
    this.delay = delay;
  }
}
