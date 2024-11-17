/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export async function* typingEffect(
  maxCharsPerChunk: number,
  stream: AsyncIterable<string>,
): AsyncIterableIterator<string> {
  for await (const chunk of stream) {
    for (let start = 0; start < chunk.length; start += maxCharsPerChunk) {
      yield chunk.slice(start, start + maxCharsPerChunk);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
}
