/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capability, NodeValue } from "@breadboard-ai/types";

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

export const clone = (streamCapability: StreamCapabilityType) => {
  const [leave, take] = streamCapability.stream.tee();
  streamCapability.stream = leave;
  return take;
};

export const isStreamCapability = (object: unknown) => {
  const maybeStream = object as StreamCapabilityType;
  return (
    maybeStream &&
    maybeStream.kind &&
    maybeStream.kind === STREAM_KIND &&
    maybeStream.stream instanceof ReadableStream
  );
};

// TODO: Remove this once MessageController is gone.
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

export const stringifyWithStreams = (value: unknown) => {
  const foundStreams: ReadableStream[] = [];
  return {
    value: JSON.stringify(value, (key, value) => {
      if (isStreamCapability(value)) {
        foundStreams.push(value.stream);
        return { $type: "Stream", id: foundStreams.length - 1 };
      }
      return value;
    }),
    streams: foundStreams,
  };
};

export const parseWithStreams = (
  value: string,
  getStream: (id: number) => ReadableStream
) => {
  const parsed = JSON.parse(value, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (value.$type === "Stream" && typeof value.id === "number") {
        return new StreamCapability(getStream(value.id));
      }
    }
    return value;
  });
  return parsed;
};

export const getStreams = (value: NodeValue) => {
  const foundStreams: ReadableStream[] = [];
  findStreams(value, foundStreams);
  return foundStreams;
};

/**
 * Stubs out all streams in the input values with empty streams.
 * This is useful when we don't want the streams to be transferred.
 * @param data
 * @returns
 */
export const stubOutStreams = (data: unknown): unknown => {
  const stringified = stringifyWithStreams(data).value;
  return parseWithStreams(stringified, () => new ReadableStream());
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
      const stringified = stringifyWithStreams(chunk);
      port.postMessage(chunk, stringified.streams);
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

export const portFactoryToStreams = <Read, Write>(
  portFactory: () => Promise<MessagePortLike>
): PortStreams<Read, Write> => {
  let streams: PortStreams<Read, Write>;
  const streamsAvailable = new Promise<void>((resolve) => {
    portFactory().then((port) => {
      streams = portToStreams(port);
      resolve();
    });
  });
  const readable = new ReadableStream<Read>({
    async start() {
      await streamsAvailable;
    },
    pull(controller) {
      return streams.readable.pipeTo(
        new WritableStream({
          write(chunk) {
            controller.enqueue(chunk);
          },
        })
      );
    },
    cancel() {
      streams.readable.cancel();
    },
  });
  const writable = new WritableStream<Write>({
    async start() {
      await streamsAvailable;
    },
    async write(chunk) {
      const writer = streams.writable.getWriter();
      await writer.write(chunk);
      writer.releaseLock();
    },
    async close() {
      await streams.writable.close();
    },
    async abort(reason) {
      await streams.writable.abort(reason);
    },
  });
  return {
    readable,
    writable,
  };
};

export class WritableResult<Read, Write> {
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

export type AsyncIterableWithStart<T, S> = AsyncIterable<T> & {
  start: (chunk: S) => Promise<void>;
};

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
): AsyncIterableWithStart<WritableResult<Read, Write>, Write> => {
  return {
    async start(chunk: Write) {
      const writer = writable.getWriter();
      await writer.write(chunk);
      writer.releaseLock();
    },
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

export const streamFromReader = <Read>(
  reader: ReadableStreamDefaultReader<Read>
) => {
  return new ReadableStream(
    {
      async pull(controller) {
        const { value, done } = await reader.read();

        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      },
    },
    { highWaterMark: 0 }
  ) as PatchedReadableStream<Read>;
};

export const streamFromWriter = <Write>(
  writer: WritableStreamDefaultWriter<Write>
) => {
  return new WritableStream<Write>(
    {
      async write(chunk) {
        return writer.write(chunk);
      },
    },
    { highWaterMark: 0 }
  );
};
