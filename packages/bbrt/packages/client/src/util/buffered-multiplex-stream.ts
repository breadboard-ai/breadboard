/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Deferred} from './deferred.js';

type State = 'unstarted' | 'started' | 'ended';

export class BufferedMultiplexStream<T> {
  readonly #source: AsyncIterable<T>;
  readonly #buffer: T[] = [];
  #state: State = 'unstarted';
  #nextTick = new Deferred<void>();

  constructor(source: AsyncIterable<T>) {
    this.#source = source;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    void this.#startBufferingIfNeeded();
    let i = 0;
    while (true) {
      while (i < this.#buffer.length) {
        yield this.#buffer[i++]!;
      }
      if (this.#state === 'ended') {
        return;
      }
      await this.#nextTick.promise;
    }
  }

  #tick() {
    this.#nextTick.resolve();
    this.#nextTick = new Deferred();
  }

  async #startBufferingIfNeeded() {
    if (this.#state !== 'unstarted') {
      return;
    }
    this.#state = 'started';
    for await (const value of this.#source) {
      this.#buffer.push(value);
      this.#tick();
    }
    this.#state = 'ended';
    this.#tick();
  }
}
