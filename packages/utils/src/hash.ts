/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeValue } from "@breadboard-ai/types";

/**
 * A function that computes a hash for a node value.
 * This is likely an overkill for most use cases, but when we
 * need to compare objects quickly, this function comes in handy.
 *
 * @param o
 * @returns
 */
export function hash(o: NodeValue) {
  let hash = 0;
  const seenObjects = new WeakSet();
  const stack = [o];

  while (stack.length) {
    const current = stack.pop();

    if (current && typeof current === "object") {
      // This is probably not necessary for NodeValue,
      // but just in case, let's avoid cycles.
      if (seenObjects.has(current)) continue;
      seenObjects.add(current);

      if (Array.isArray(current)) {
        stack.push(current.length);
        for (let i = current.length - 1; i >= 0; i--) {
          stack.push(current[i]);
        }
      } else {
        for (const key in current) {
          const value = current[key as keyof typeof current];
          // Hash the key
          hash = combineHashes(hash, hashString(key));
          stack.push(value);
        }
      }
    } else {
      // Hash primitive values directly
      hash = combineHashes(hash, hashString(String(current)));
    }
  }

  return hash >>> 0; // Ensure unsigned 32-bit integer
}

function combineHashes(prevHash: number, hash: number) {
  // Combines two hashes using bit manipulation
  return (prevHash * 31 + hash) | 0;
}

/**
 * Computes a hash for a string using the DJB2 algorithm.
 * @param str
 * @returns
 */
function hashString(str: string) {
  let hash = 5381;
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  return hash >>> 0;
}
