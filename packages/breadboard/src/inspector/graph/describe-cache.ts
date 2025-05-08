/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  DescribeResultCacheArgs,
  InspectableDescriberResultCache,
  InspectableDescriberResultCacheEntry,
} from "../types.js";
import { AffectedNode } from "../../editor/types.js";
import {
  SnapshotUpdater,
  SnapshotUpdaterArgs,
} from "../../utils/snapshot-updater.js";
import { NodeDescriberResult } from "../../types.js";

export { DescribeResultCache };

type MapItem = SnapshotUpdater<NodeDescriberResult>;

class DescribeResultCache implements InspectableDescriberResultCache {
  #map = new Map<string, MapItem>();

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

  #createKey(id: NodeIdentifier, graphId: GraphIdentifier) {
    return `${graphId}:${id}`;
  }

  get(
    id: NodeIdentifier,
    graphId: GraphIdentifier
  ): InspectableDescriberResultCacheEntry {
    const key = this.#createKey(id, graphId);
    let result = this.#map.get(key);
    if (result) {
      return result.snapshot();
    }
    result = new SnapshotUpdater(this.#createSnapshotArgs(graphId, id));
    this.#map.set(key, result);
    return result.snapshot();
  }

  update(affectedNodes: AffectedNode[]) {
    affectedNodes.forEach(({ id, graphId }) => {
      const key = this.#createKey(id, graphId);
      this.#map.get(key)?.refresh();
    });
  }

  clear(visualOnly: boolean, affectedNodes: AffectedNode[]) {
    if (visualOnly) {
      return;
    }
    affectedNodes.forEach(({ id, graphId }) => {
      const key = this.#createKey(id, graphId);
      this.#map.delete(key);
    });
  }
}
