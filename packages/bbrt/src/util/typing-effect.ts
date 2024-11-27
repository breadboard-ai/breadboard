/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO(aomarks) Keep a buffer so that we can guarantee we are only up to Nms
// behind the latest stream. We want to create a smooth typing effect, but we
// also don't want to fall behind the tail of the stream too far.
export async function* typingEffect(
  maxCharsPerChunk: number,
  stream: AsyncIterable<string>
): AsyncIterableIterator<string> {
  for await (const chunk of stream) {
    for (let start = 0; start < chunk.length; start += maxCharsPerChunk) {
      yield chunk.slice(start, start + maxCharsPerChunk);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
}
