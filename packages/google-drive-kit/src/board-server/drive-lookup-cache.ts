/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DriveChange } from "./operations.js";

/** Responsible for cleaning lookup caches based on list of changes from drive. */
export class DriveLookupCache {
  constructor(
    private readonly cacheName: string,
    private readonly cacheKeyPrefix: string
  ) {}

  async invalidateId(fileID: string) {
    const cache = await caches.open(this.cacheName);
    const cacheKey = new URL(`${this.cacheKeyPrefix}${fileID}`);
    await cache.delete(cacheKey);
  }

  async invalidateAllItems() {
    await caches.delete(this.cacheName);
  }

  /** Returns drive file IDs that were purged. */
  async processChanges(changes: Array<DriveChange>): Promise<Array<string>> {
    const ids = changes.map((change) => change.fileId);
    const cache = await caches.open(this.cacheName);
    // Bulk remove in parallel.
    const deletedIds = await Promise.all(
      ids.map((id) => {
        const cacheKey = new URL(`${this.cacheKeyPrefix}${id}`);
        return cache.delete(cacheKey).then((deleted) => (deleted ? id : null));
      })
    );
    return deletedIds.filter((id) => !!id) as string[];
  }
}
