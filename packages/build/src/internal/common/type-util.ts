/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Count the number of items in a type union.
 *
 * Examples:
 *
 * never ........... 0
 * "foo" ........... 1
 * "foo" | "bar" ... 2
 */
export type CountUnion<U> = PermuteUnion<U>["length"];

/**
 * Generate all permutations of the given union as a union of tuples.
 *
 * WARNING: This type has quadratic complexity, so it should only be used where
 * it is expected that the number of values is very small, such as enforcing
 * that something is 0 or 1.
 *
 * Examples:
 *
 * never ........... []
 * "foo" ........... ["foo"]
 * "foo" | "bar" ... ["foo", "bar"] | ["bar", "foo"]
 */
type PermuteUnion<U, T = U> = [U] extends [never]
  ? []
  : T extends unknown
    ? [T, ...PermuteUnion<Exclude<U, T>>]
    : never;
