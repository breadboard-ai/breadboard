/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capability, NodeValue } from "./types.js";

const STREAM_KIND = "stream" as const;

export interface StreamCapabilityType<ChunkType = object> extends Capability {
  kind: typeof STREAM_KIND;
  stream: ReadableStream<ChunkType>;
}

export class StreamCapability<ChunkType>
  implements StreamCapabilityType<ChunkType>
{
  kind = STREAM_KIND;
  stream: ReadableStream<ChunkType>;

  constructor(stream: ReadableStream<ChunkType>) {
    this.stream = stream;
  }
}

export const isStreamCapability = (object: unknown) => {
  const maybeStream = object as StreamCapabilityType;
  return (
    maybeStream.kind &&
    maybeStream.kind === STREAM_KIND &&
    maybeStream.stream instanceof ReadableStream
  );
};

const findStreams = (value: NodeValue, foundStreams: ReadableStream[]) => {
  if (Array.isArray(value)) {
    value.forEach((item: NodeValue) => {
      findStreams(item, foundStreams);
    });
  } else if (typeof value === "object") {
    if (value === null || value === undefined) return;
    const maybeCapability = value as StreamCapabilityType;
    if (maybeCapability.kind && maybeCapability.kind === STREAM_KIND) {
      foundStreams.push(maybeCapability.stream);
    } else {
      Object.values(value as object).forEach((item) => {
        findStreams(item, foundStreams);
      });
    }
  }
};

export const getStreams = (value: NodeValue) => {
  const foundStreams: ReadableStream[] = [];
  findStreams(value, foundStreams);
  return foundStreams;
};

export type PatchedReadableStream<T> = ReadableStream<T> & AsyncIterable<T>;

interface MessagePortLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((ev: MessageEvent) => unknown) | null;
}

export type PortStreams<Read, Write> = {
  readable: ReadableStream<Read>;
  writable: WritableStream<Write>;
};

export const portToStreams = <Read, Write>(
  port: MessagePortLike
): PortStreams<Read, Write> => {
  const readable = new ReadableStream<Read>({
    start(controller) {
      port.onmessage = (ev) => {
        if (ev.data === null) {
          controller.close();
          return;
        }
        controller.enqueue(ev.data);
      };
    },
    cancel() {
      port.onmessage = null;
    },
  });
  const writable = new WritableStream<Write>({
    write(chunk) {
      const foundStreams: ReadableStream[] = [];
      findStreams(chunk as NodeValue, foundStreams);
      port.postMessage(chunk, foundStreams);
    },
    close() {
      port.postMessage(null, []);
    },
  });
  return {
    readable,
    writable,
  };
};

class WritableResult<Read, Write> {
  #writer: WritableStreamDefaultWriter<Write>;
  data: Read;

  constructor(value: Read, writer: WritableStreamDefaultWriter<Write>) {
    this.#writer = writer;
    this.data = value;
  }

  async reply(chunk: Write) {
    await this.#writer.write(chunk);
  }
}

class StreamsAsyncIterator<Read, Write>
  implements AsyncIterator<WritableResult<Read, Write>, void, unknown>
{
  #reader: ReadableStreamDefaultReader<Read>;
  #writer: WritableStreamDefaultWriter<Write>;
  constructor(writable: WritableStream<Write>, readable: ReadableStream<Read>) {
    this.#reader = readable.getReader();
    this.#writer = writable.getWriter();
  }

  async next(): Promise<IteratorResult<WritableResult<Read, Write>, void>> {
    const { done, value } = await this.#reader.read();
    if (done) {
      this.#writer.close();
      return { done, value: undefined };
    }
    return {
      done: false,
      value: new WritableResult<Read, Write>(value, this.#writer),
    };
  }

  async return(): Promise<IteratorResult<WritableResult<Read, Write>, void>> {
    this.#writer.close();
    return { done: true, value: undefined };
  }

  async throw(
    err: Error
  ): Promise<IteratorResult<WritableResult<Read, Write>, void>> {
    this.#writer.abort(err);
    return { done: true, value: undefined };
  }
}

/**
 * A helper to convert a pair of streams to an async iterable that follows
 * the following protocol:
 * - The async iterable yields a `WritableResult` object.
 * - The `WritableResult` object contains the data from the readable stream.
 * - The `WritableResult` object has a `reply` method that can be used to
 *   write a value as a reply to to data in the readable stream.
 *
 * This is particularly useful with bi-directional streams, when the two
 * streams are semantically connected to each other.
 *
 * @param writable The writable stream.
 * @param readable The readable stream.
 * @returns An async iterable.
 */
export const streamsToAsyncIterable = <Read, Write>(
  writable: WritableStream<Write>,
  readable: ReadableStream<Read>
): AsyncIterable<WritableResult<Read, Write>> => {
  return {
    [Symbol.asyncIterator]() {
      return new StreamsAsyncIterator<Read, Write>(writable, readable);
    },
  };
};

// Polyfill to make ReadableStream async iterable
// See https://bugs.chromium.org/p/chromium/issues/detail?id=929585
export const patchReadableStream = () => {
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
};

// A polyfill for ReadableStream.from:
// See https://streams.spec.whatwg.org/#rs-from
// TODO: Do a proper TypeScript types polyfill.
export const streamFromAsyncGen = <T>(
  iterator: AsyncIterableIterator<T>
): PatchedReadableStream<T> => {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
  }) as PatchedReadableStream<T>;
};
