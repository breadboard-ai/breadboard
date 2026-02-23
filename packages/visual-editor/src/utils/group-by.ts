/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Groups items by a key function into a `Map<K, T[]>`.
 *
 * Déjà Code — extracted from the inline `has/set/get/push` pattern that
 * appeared in layout-graph.ts and elsewhere.
 *
 * @example
 * ```ts
 * const byDepth = groupBy(depth, ([_id, d]) => d, ([id]) => id);
 * ```
 */

export { groupBy };

function groupBy<T, K, V = T>(
  items: Iterable<T>,
  keyFn: (item: T) => K,
  valueFn?: (item: T) => V
): Map<K, V[]> {
  const map = new Map<K, V[]>();
  for (const item of items) {
    const key = keyFn(item);
    const value = valueFn ? valueFn(item) : (item as unknown as V);
    let group = map.get(key);
    if (!group) {
      group = [];
      map.set(key, group);
    }
    group.push(value);
  }
  return map;
}
