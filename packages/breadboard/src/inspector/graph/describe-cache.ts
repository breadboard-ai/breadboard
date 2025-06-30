/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AffectedNode,
  DescribeResultCacheArgs,
  GraphIdentifier,
  InspectableDescriberResultCache,
  InspectableDescriberResultCacheEntry,
  NodeDescriberResult,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { hash } from "../../utils/hash.js";
import {
  SnapshotUpdater,
  SnapshotUpdaterArgs,
} from "../../utils/snapshot-updater.js";

export { DescribeResultCache };

type MapItem = SnapshotUpdater<NodeDescriberResult>;

class DescribeResultCache implements InspectableDescriberResultCache {
  #map = new Map<number, MapItem>();

  constructor(public readonly args: DescribeResultCacheArgs) {}

  #createSnapshotArgs(graphId: GraphIdentifier, nodeId: NodeIdentifier) {
    return {
      initial: () => this.args.initial(graphId, nodeId),
      latest: () => this.args.latest(graphId, nodeId),
      willUpdate: (previous, current) =>
        this.args.willUpdate(previous, current),
      updated: () => {
        this.args.updated(graphId, nodeId);
      },
    } as SnapshotUpdaterArgs<NodeDescriberResult>;
  }

  get(
    id: NodeIdentifier,
    graphId: GraphIdentifier
  ): InspectableDescriberResultCacheEntry {
    const hash = computeHash({ id, graphId });
    let result = this.#map.get(hash);
    if (result) {
      return result.snapshot();
    }
    result = new SnapshotUpdater(this.#createSnapshotArgs(graphId, id));
    this.#map.set(hash, result);
    return result.snapshot();
  }

  update(affectedNodes: AffectedNode[]) {
    affectedNodes.forEach((affected) => {
      const hash = computeHash(affected);
      this.#map.get(hash)?.refresh();
    });
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
