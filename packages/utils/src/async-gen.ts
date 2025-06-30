/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type AsyncGenNext<T> = (value: T) => Promise<void>;
export type AsyncGenCallback<T> = (next: AsyncGenNext<T>) => Promise<void>;

type QueueEntry<T> = {
  value: T | undefined;
  receipt: () => void;
};

const noop = () => {
  /* noop */
};

class AsyncGenQueue<T> {
  #queue: QueueEntry<T>[] = [];
  #wroteIntoQueue = noop;
  #whenQueuedUp: Promise<void> | undefined;
  #lastReceipt: (() => void) | undefined;
  abort: (err: Error) => void = noop;

  constructor() {
    this.#setQueuePromise();
  }

  #setQueuePromise() {
    this.#whenQueuedUp = new Promise<void>((resolve, reject) => {
      this.#wroteIntoQueue = resolve;
      this.abort = reject;
    });
  }

  #addToQueue(entry: QueueEntry<T>) {
    this.#queue.push(entry);
    if (this.#queue.length == 1) {
      this.#wroteIntoQueue();
      this.#setQueuePromise();
    }
  }

  async write(value: T): Promise<void> {
    return new Promise((receipt) => {
      this.#addToQueue({ value, receipt });
    });
  }

  async read(): Promise<IteratorResult<T, void>> {
    this.#lastReceipt?.();
    if (this.#queue.length === 0) {
      await this.#whenQueuedUp;
    }
    const entry = this.#queue.shift();
    if (!entry) {
      throw new Error("asyncGen queue should never be empty.");
    }
    this.#lastReceipt = entry.receipt;
    if (!entry.value) {
      return { done: true, value: undefined };
    }
    return { done: false, value: entry.value };
  }

  close(): void {
    this.#addToQueue({ value: undefined, receipt: noop });
  }
}

class AsyncGenIterator<T> implements AsyncIterator<T, void, unknown> {
  #callback: AsyncGenCallback<T>;
  #firstTime = true;
  #queue = new AsyncGenQueue<T>();

  constructor(callback: AsyncGenCallback<T>) {
    this.#callback = callback;
  }

  /**
   * Called by the callback to advance to the next value.
   * Roughly equivalent to "yield":
   * ```ts
   * yield value;
   * ```
   * same as
   * ```ts
   * await next(value);
   * ```
   * @param value
   */
  async #next(value: T): Promise<void> {
    return this.#queue.write(value);
  }

  async next(): Promise<IteratorResult<T, void>> {
    if (this.#firstTime) {
      this.#firstTime = false;
      this.#callback(this.#next.bind(this))
        .then(() => {
          this.#queue.close();
        })
        .catch((err) => {
          this.#queue.abort(err);
        });
    }
    return this.#queue.read();
  }
}

/**
 * Converts async/await style code into an async generator.
 * Useful when you need to combine arrow-style functions and yield.
 *
 * Example:
 *
 * ```ts
 * async function* foo() {
 *   yield 1;
 *   yield* asyncGen(async (next) => {
 *     await next(2);
 *     await next(3);
 *   });
 *   yield 4;
 * }
 *
 * for await (const val of foo()) {
 *   console.log(val);
 * }
 * ```
 *
 * This code will print:
 *
 * ```
 * 1
 * 2
 * 3
 * 4
 * ```
 *
 * @param callback A callback that will be called with a `next` function.
 * The callback should call `next` with the next value to yield.
 * @returns An async generator.
 */
export const asyncGen = <T>(callback: AsyncGenCallback<T>) => {
  return {
    [Symbol.asyncIterator]() {
      return new AsyncGenIterator<T>(callback);
    },
  };
};
