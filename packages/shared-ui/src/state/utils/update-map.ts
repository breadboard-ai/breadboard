/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { updateMap, updateMapDynamic };

/**
 * Incrementally updates a map, given updated values.
 * Updates the values in `updated`, deletes the ones that aren't in it.
 */
function updateMap<T extends Map<K, V>, K = string, V = unknown>(
  map: T,
  updated: [K, V][]
): void {
  const toDelete = new Set(map.keys());

  updated.forEach(([key, value]) => {
    map.set(key, value);
    toDelete.delete(key);
  });

  [...toDelete.values()].forEach((key) => {
    map.delete(key);
  });
}

type MapEntryUpdater<I = unknown, V = unknown> = {
  create(from: I): V;
  update(from: I, existing: V): V;
};

function updateMapDynamic<K = string, I = unknown, V = unknown>(
  map: Map<K, V>,
  updated: [K, I][],
  updater: MapEntryUpdater<I, V>
): void {
  const toDelete = new Set(map.keys());

  updated.forEach(([key, initial]) => {
    const existing = map.get(key);
    if (!existing) {
      const value = updater.create(initial);
      map.set(key, value);
    } else {
      const value = updater.update(initial, existing);
      if (value !== existing) {
        map.set(key, value);
      }
    }
    toDelete.delete(key);
  });

  [...toDelete.values()].forEach((key) => {
    map.delete(key);
  });
}
