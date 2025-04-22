/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

interface QueueItem<T, R = unknown> {
  /** The function that returns the promise to be executed. */
  task: () => Promise<T>;
  /** The resolve function for the promise returned by `add`. */
  resolve: (value: T | PromiseLike<T>) => void;
  /** The reject function for the promise returned by `add`. */
  reject: (reason?: R) => void;
}

/**
 * A class that manages a queue of promise-returning functions,
 * ensuring they are executed sequentially (one after another).
 */
export class PromiseQueue<T> {
  #queue: QueueItem<T>[] = [];
  #processing = false;

  /**
   * Adds a promise-returning function (task factory) to the queue.
   * The task will be executed only after all preceding tasks in the queue have completed.
   *
   * @template T The expected type of the result from the promise factory.
   * @param task A function that returns a Promise.
   * @returns A Promise that resolves or rejects with the result of the added task,
   * once it's executed.
   */
  add(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.#queue.push({ task, resolve, reject });
      this.#processQueue();
    });
  }

  async #processQueue(): Promise<void> {
    if (this.#processing || this.#queue.length === 0) {
      return;
    }

    this.#processing = true;
    const current = this.#queue.shift()!;

    try {
      const result = await current.task();
      current.resolve(result);
    } catch (error) {
      current.reject(error);
    } finally {
      this.#processing = false;
      this.#processQueue();
    }
  }

  get size(): number {
    return this.#queue.length;
  }

  get processing(): boolean {
    return this.#processing;
  }
}
