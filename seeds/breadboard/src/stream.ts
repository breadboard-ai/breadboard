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
