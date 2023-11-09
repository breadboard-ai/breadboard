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
