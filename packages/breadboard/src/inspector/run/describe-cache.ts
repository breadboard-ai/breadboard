/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  InspectableDescriberResultCache,
  InspectableDescriberResultCacheEntry,
} from "../types.js";
import { AffectedNode } from "../../editor/types.js";
import { hash } from "../../utils/hash.js";

export { DescribeResultCache };

class DescribeResultCache implements InspectableDescriberResultCache {
  #map = new Map<number, InspectableDescriberResultCacheEntry>();

  #latestResolved(
    entry: InspectableDescriberResultCacheEntry
  ): InspectableDescriberResultCacheEntry {
    let current = entry.current;
    return {
      get current() {
        return current;
      },
      latest: entry.latest.then((latest) => {
        current = latest;
        return latest;
      }),
    };
  }

  getOrCreate(
    id: NodeIdentifier,
    graphId: GraphIdentifier,
    factory: () => InspectableDescriberResultCacheEntry
  ): InspectableDescriberResultCacheEntry {
    const hash = computeHash({ id, graphId });
    let result = this.#map.get(hash);
    if (result) {
      return result;
    }
    result = factory();
    this.#map.set(hash, this.#latestResolved(result));
    return result;
  }

  clear(visualOnly: boolean, affectedNodes: AffectedNode[]) {
    if (visualOnly) {
      return;
    }
    affectedNodes.forEach((node) => {
      const hash = computeHash(node);
      this.#map.delete(hash);
    });
  }
}

function computeHash(node: AffectedNode): number {
  return hash(node);
}
