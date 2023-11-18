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
  tag: string,
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
