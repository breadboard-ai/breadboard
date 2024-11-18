/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type ReleaseFn = () => void;

export class Lock {
  readonly #queue: Array<(release: ReleaseFn) => void> = [];
  #locked = false;

  acquire(): Promise<ReleaseFn> {
    return new Promise((resolve) => {
      if (!this.#locked) {
        this.#locked = true;
        resolve(this.#release);
      } else {
        this.#queue.push(resolve);
      }
    });
  }

  async do<T>(work: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await work();
    } finally {
      release();
    }
  }

  #release: ReleaseFn = () => {
    if (this.#queue.length > 0) {
      const resolve = this.#queue.shift()!;
      resolve(this.#release);
    } else {
      this.#locked = false;
    }
  };
}
