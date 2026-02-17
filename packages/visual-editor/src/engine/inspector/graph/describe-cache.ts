/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";

import type {
  AffectedNode,
  GraphIdentifier,
  GraphStoreArgs,
  InspectableDescriberResultCache,
  InspectableDescriberResultCacheEntry,
  MutableGraph,
  NodeDescriberResult,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { getHandler } from "../../runtime/legacy.js";

export { DescribeResultCache };

function emptyResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

class SignalBackedEntry {
  #current: Signal.State<NodeDescriberResult>;
  #updating: Signal.State<boolean> = new Signal.State(true);
  #latestPromise: Promise<NodeDescriberResult>;

  #mutable: MutableGraph;
  #deps: GraphStoreArgs;
  #graphId: GraphIdentifier;
  #nodeId: NodeIdentifier;

  constructor(
    mutable: MutableGraph,
    deps: GraphStoreArgs,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ) {
    this.#mutable = mutable;
    this.#deps = deps;
    this.#graphId = graphId;
    this.#nodeId = nodeId;
    this.#current = new Signal.State(emptyResult());
    this.#latestPromise = this.#fetchLatest();
  }

  async #fetchLatest(): Promise<NodeDescriberResult> {
    this.#updating.set(true);
    try {
      const node = this.#mutable.nodes.get(this.#nodeId, this.#graphId);
      if (!node) {
        this.#updating.set(false);
        return this.#current.get();
      }
      const context = {
        sandbox: this.#deps.sandbox,
        graphStore: this.#mutable.store,
      };
      const handler = await getHandler(node.descriptor.type, context);
      if (!handler || !("describe" in handler) || !handler.describe) {
        this.#updating.set(false);
        return this.#current.get();
      }
      const latest = await handler.describe(
        { ...node.configuration() },
        { type: "object" },
        { type: "object" },
        {
          sandbox: this.#deps.sandbox,
          graphStore: this.#mutable.store,
          flags: this.#deps.flags,
          asType: false,
        }
      );
      this.#current.set(latest);
      this.#updating.set(false);
      return latest;
    } catch {
      this.#updating.set(false);
      return this.#current.get();
    }
  }

  refresh() {
    this.#latestPromise = this.#fetchLatest();
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
  #map = new Map<string, SignalBackedEntry>();
  #mutable: MutableGraph;
  #deps: GraphStoreArgs;

  constructor(mutable: MutableGraph, deps: GraphStoreArgs) {
    this.#mutable = mutable;
    this.#deps = deps;
  }

  get(
    id: NodeIdentifier,
    graphId: GraphIdentifier
  ): InspectableDescriberResultCacheEntry {
    const key = `${graphId}:${id}`;
    let entry = this.#map.get(key);
    if (!entry) {
      entry = new SignalBackedEntry(this.#mutable, this.#deps, graphId, id);
      this.#map.set(key, entry);
    }
    return entry.snapshot();
  }

  update(affectedNodes: AffectedNode[]) {
    affectedNodes.forEach((affected) => {
      const key = `${affected.graphId}:${affected.id}`;
      this.#map.get(key)?.refresh();
    });
  }
}
