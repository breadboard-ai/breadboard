/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeValue, RunState } from "./types.js";

// Polyfill to make ReadableStream async iterable
// See https://bugs.chromium.org/p/chromium/issues/detail?id=929585
// eslint-disable-next-line
// @ts-ignore
ReadableStream.prototype[Symbol.asyncIterator] ||
  // eslint-disable-next-line
  // @ts-ignore
  (ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  });

export type RemoteRunResult = {
  inputs: NodeValue;
  state: RunState;
};

class BoardStreamer<ResponseType = unknown>
  implements TransformStream<Uint8Array, ResponseType>
{
  writable: WritableStream<Uint8Array>;
  readable: ReadableStream<ResponseType>;
  controller: ReadableStreamDefaultController<ResponseType> | null = null;

  constructor() {
    this.writable = new WritableStream({
      write: (chunk) => this.write(chunk),
    });
    this.readable = new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
    });
  }

  write(chunk: Uint8Array) {
    const decoder = new TextDecoder();
    const s = decoder.decode(chunk);
    s.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .forEach((line) => {
        try {
          if (line === "stop") {
            this.controller?.close();
            return;
          }
          const data = JSON.parse(line);
          this.controller?.enqueue(data);
        } catch (e) {
          console.error(e);
        }
      });
  }
}

/**
 * Posts the inputs to the breadboard-server and returns a stream of results.
 */
const post = async (url: string, inputs: NodeValue, state?: string) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs, state }),
  });
  return response.body?.pipeThrough(
    new BoardStreamer()
  ) as unknown as AsyncIterable<RemoteRunResult>;
};

export async function* runRemote(url: string) {
  let inputs = undefined;
  let state = undefined;
  for (;;) {
    const stream = await post(url, inputs, state);
    if (!stream) break;
    for await (const result of stream) {
      state = JSON.stringify(result.state);
      yield result;
      inputs = result.inputs;
    }
    if (!state) break;
  }
}
