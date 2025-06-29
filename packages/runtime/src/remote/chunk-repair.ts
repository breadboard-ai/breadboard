/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const getCompleteChunks = (pending: string, chunk: string) => {
  const asString = `${pending}${chunk}`;
  return asString.split("\n\n");
};

/**
 * When processing HTTP responses, the server may send chunks that are
 * broken in two ways:
 * - Multiple chunks might be merged together
 * - A single chunk might be broken into multiple chunks.
 *
 * This transform stream repairs such chunks, merging broken chunks and
 * splitting merged chunks.
 *
 * @returns The transform stream that repaired chunks.
 */
export const chunkRepairTransform = () => {
  let brokenChunk: string | null = null;
  // Four variants of chunk breakage:
  // 0. o | o -- no breakage. There aren't pending chunks, and the current
  //   chunk is fine.
  // 1. x | o -- the current chunk looks fine, but it's actually the completion
  //    of a previous broken chunk.
  // 2. o | x -- the current chunk is broken, and the next chunk will complete
  //    it.
  // 3. x | x -- both the current chunk and the next chunk are broken. Here,
  //    the two chunks likely have a complete chunk somewhere in the middle
  //    (or not), yet there's a broken left-over chunk at the end.
  return new TransformStream<string, string>({
    transform(incomingChunk, controller) {
      const enqueue = (chunk: string) => {
        controller.enqueue(`${chunk}\n\n`);
      };

      const missingEndMarker = !incomingChunk.endsWith("\n\n");
      const chunks = incomingChunk.split("\n\n");
      if (!missingEndMarker) {
        chunks.pop();
      }
      for (const [i, chunk] of chunks.entries()) {
        const last = i === chunks.length - 1;
        // Is this particular chunk broken?
        const isBroken = last && missingEndMarker;
        if (isBroken) {
          if (brokenChunk !== null) {
            // Variant 3: x | x
            const completeChunks = getCompleteChunks(brokenChunk, chunk);
            const allComplete = completeChunks.at(-1) === "";
            if (allComplete) {
              completeChunks.pop();
              brokenChunk = null;
            } else {
              brokenChunk = completeChunks.pop() ?? null;
            }
            for (const completeChunk of completeChunks) {
              enqueue(completeChunk);
            }
          } else {
            // Variant 2: o | x
            brokenChunk = chunk;
          }
        } else {
          if (brokenChunk !== null) {
            // Variant 1: x | o
            const completeChunks = getCompleteChunks(brokenChunk, chunk);
            for (const completeChunk of completeChunks) {
              enqueue(completeChunk);
            }
            brokenChunk = null;
          } else {
            // Variant 0: o | o
            enqueue(chunk);
          }
        }
      }
    },
  });
};
