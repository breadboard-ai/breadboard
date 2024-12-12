/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Deferred } from "./deferred.js";

type State = "unstarted" | "started" | "ended";

export class CachingMultiplexStream<T> {
  readonly #source: AsyncIterable<T>;
  // TODO(aomarks) Should not be public.
  readonly buffer: T[] = [];
  // TODO(aomarks) Should not be public.
  state: State = "unstarted";
  #nextTick = new Deferred<void>();

  constructor(source: AsyncIterable<T>) {
    this.#source = source;
  }

  static finished<T>(values: Iterable<T>) {
    // TODO(aomarks) Shouldn't need this constructor. It's only because of
    // weirdness in our serialization scheme.
    const stream = new CachingMultiplexStream<T>((async function* () {})());
    stream.state = "ended";
    for (const value of values) {
      stream.buffer.push(value);
    }
    return stream;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    void this.#startBufferingIfNeeded();
    let i = 0;
    while (true) {
      while (i < this.buffer.length) {
        yield this.buffer[i++]!;
      }
      if (this.state === "ended") {
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
    if (this.state !== "unstarted") {
      return;
    }
    this.state = "started";
    for await (const value of this.#source) {
      this.buffer.push(value);
      this.#tick();
    }
    this.state = "ended";
    this.#tick();
  }
}
