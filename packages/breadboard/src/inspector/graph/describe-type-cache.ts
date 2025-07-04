/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DescribeResultTypeCacheArgs,
  InspectableDescriberResultCacheEntry,
  InspectableDescriberResultTypeCache,
  NodeDescriberResult,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { SnapshotUpdater } from "@breadboard-ai/utils";

export { DescribeResultTypeCache };

type MapItem = SnapshotUpdater<NodeDescriberResult>;

class DescribeResultTypeCache implements InspectableDescriberResultTypeCache {
  #map = new Map<NodeTypeIdentifier, MapItem>();

  constructor(public readonly args: DescribeResultTypeCacheArgs) {}

  get(type: NodeTypeIdentifier): InspectableDescriberResultCacheEntry {
    let result = this.#map.get(type);
    if (result) {
      return result.snapshot();
    }
    result = new SnapshotUpdater({
      initial: () => this.args.initial(),
      latest: () => this.args.latest(type),
      updated: () => this.args.updated(type),
    });
    this.#map.set(type, result);
    return result.snapshot();
  }

  update(affectedTypes: NodeTypeIdentifier[]): void {
    for (const type of affectedTypes) {
      this.#map.delete(type);
    }
  }
  clear(): void {
    this.#map.clear();
  }
}
