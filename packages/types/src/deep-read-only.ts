/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Recursively makes all properties of a type readonly.
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : // New checks for Map and Set
    T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends Set<infer I>
      ? ReadonlySet<DeepReadonly<I>>
      : // Fallback for plain objects
        T extends object
        ? {
            readonly [P in keyof T]: DeepReadonly<T[P]>;
          }
        : T;
