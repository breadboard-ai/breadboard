/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { parse } from "jsonriver";

export async function* streamJsonArrayItems<T = unknown>(
  stream: AsyncIterable<string>
): AsyncIterable<T> {
  let array: T[] | undefined;
  let nextYieldIdx = 0;
  let firstParse = true;
  for await (const parsed of parse(stream)) {
    if (firstParse) {
      if (!Array.isArray(parsed)) {
        const msg =
          `Internal error: Expected an array, got ` +
          `${JSON.stringify(parsed)}`;
        console.error(msg);
        throw new Error(msg);
      }
      array = parsed as T[];
      firstParse = false;
    } else if (parsed !== array) {
      const msg =
        `Internal error: Expected the same array, got ` +
        `${JSON.stringify(parsed)}`;
      console.error(msg);
      throw new Error(msg);
    }
    // Yield only up to the second-to-last item, because we only want to yield
    // complete items, and the last item might not be fully parsed yet
    // (jsonriver parses incrementally and recursively).
    for (; nextYieldIdx < array.length - 1; nextYieldIdx++) {
      yield array[nextYieldIdx]!;
    }
  }
  if (array !== undefined && array.length > 0) {
    // The last item won't have been yielded yet.
    yield array[array.length - 1]!;
  }
}
