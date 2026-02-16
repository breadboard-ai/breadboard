/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";

import type {
  AffectedNode,
  DescribeResultCacheArgs,
  GraphIdentifier,
  GraphStoreArgs,
  InspectableDescriberResultCache,
  InspectableDescriberResultCacheEntry,
  MutableGraph,
  NodeDescriberResult,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { hash } from "@breadboard-ai/utils";
import { NodeDescriberManager } from "./node-describer-manager.js";

export { DescribeResultCache };

class SignalBackedEntry {
  #current: Signal.State<NodeDescriberResult>;
  #updating: Signal.State<boolean> = new Signal.State(true);
  #latestPromise: Promise<NodeDescriberResult>;

  #args: DescribeResultCacheArgs;
  #graphId: GraphIdentifier;
  #nodeId: NodeIdentifier;

  constructor(
    args: DescribeResultCacheArgs,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ) {
    this.#args = args;
    this.#graphId = graphId;
    this.#nodeId = nodeId;
    this.#current = new Signal.State(args.initial(graphId, nodeId));
    this.#latestPromise = this.#fetchLatest();
  }

  #fetchLatest(): Promise<NodeDescriberResult> {
    this.#updating.set(true);
    const promise = this.#args
      .latest(this.#graphId, this.#nodeId)
      .then((latest) => {
        this.#current.set(latest);
        this.#updating.set(false);
        return latest;
      })
      .catch(() => {
        this.#updating.set(false);
        return this.#current.get();
      });
    this.#latestPromise = promise;
    return promise;
  }

  refresh() {
    this.#fetchLatest();
  }

  snapshot(): InspectableDescriberResultCacheEntry {
    return {
      current: this.#current.get(),
      latest: this.#latestPromise,
      updating: this.#updating.get(),
    };
  }
}

class DescribeResultCache implements InspectableDescriberResultCache {
  #map = new Map<number, SignalBackedEntry>();
  #args: DescribeResultCacheArgs;

  constructor(mutable: MutableGraph, deps: GraphStoreArgs) {
    this.#args = new NodeDescriberManager(mutable, deps);
  }

  get(
    id: NodeIdentifier,
    graphId: GraphIdentifier
  ): InspectableDescriberResultCacheEntry {
    const key = computeHash({ id, graphId });
    let entry = this.#map.get(key);
    if (!entry) {
      entry = new SignalBackedEntry(this.#args, graphId, id);
      this.#map.set(key, entry);
    }
    return entry.snapshot();
  }

  update(affectedNodes: AffectedNode[]) {
    affectedNodes.forEach((affected) => {
      const key = computeHash(affected);
      this.#map.get(key)?.refresh();
    });
  }
}

function computeHash(node: AffectedNode): number {
  return hash(node);
}
