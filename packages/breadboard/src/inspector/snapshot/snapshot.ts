/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphIdentifier,
  InspectableGraph,
  MutableGraph,
} from "@breadboard-ai/types";
import { ChangeMaker } from "./change-maker.js";
import { FreshEvent, StaleEvent } from "./events.js";
import type {
  InspectableMainGraphSnapshot,
  InspectableSnapshot,
  SnapshotChangeSpec,
  SnapshotEventTarget,
  SnapshotPendingUpdate,
} from "./types.js";

export { Snapshot };

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

type FreshResolve = (snapshot: InspectableMainGraphSnapshot) => void;

class Snapshot
  extends (EventTarget as SnapshotEventTarget)
  implements InspectableSnapshot
{
  #stale = false;
  #fresh: Promise<InspectableMainGraphSnapshot>;
  #freshResolve: FreshResolve | null = null;
  #mutable: MutableGraph;
  #changes: ChangeMaker = new ChangeMaker([]);
  #snapshot: Mutable<InspectableMainGraphSnapshot>;
  readonly #pending: SnapshotPendingUpdate[] = [];

  constructor(mutable: MutableGraph) {
    super();
    this.#mutable = mutable;
    this.#snapshot = {} as InspectableMainGraphSnapshot;
    this.#fresh = Promise.resolve(this.#snapshot);
  }

  get changes(): SnapshotChangeSpec[] {
    return this.#changes.changes;
  }

  get fresh(): Promise<InspectableMainGraphSnapshot> {
    return this.#fresh;
  }

  get pending(): readonly SnapshotPendingUpdate[] {
    return this.#pending;
  }

  #setStale() {
    if (this.#stale) return;

    this.#stale = true;
    this.dispatchEvent(new StaleEvent());
    this.#fresh = new Promise((resolve) => {
      this.#freshResolve = resolve;
    });
  }

  #setFresh() {
    if (!this.#stale) return;
    this.#stale = false;
    this.dispatchEvent(new FreshEvent());
    this.#freshResolve?.(this.#snapshot);
  }

  /**
   *
   * @param manual -- if `true`, the updates will stop once the
   *    update queue is empty, and when the new items arrive, this
   *    method will have to be called again.
   *    If `false` (default), will continue updating as soon as new
   *    items arrive into the update queue.
   */
  async update(_manual: boolean = false): Promise<void> {
    // Use inifite loop with dequeueing instead of a typical forEach,
    // because the middle of the loop has awaits and they can introduce
    // new items into the pending queue.
    for (;;) {
      const pending = this.#pending.shift();
      if (!pending) {
        this.#setFresh();
        break;
      }
      switch (pending.type) {
        case "updateports": {
          const { graphId, nodeId } = pending;
          const inspector = this.#mutable.graphs.get(graphId);
          if (!inspector) {
            throw new Error(
              `Snapshot API integrity error: unable to find graph "${graphId}"`
            );
          }
          const node = inspector.nodeById(nodeId);
          if (!node) {
            throw new Error(
              `Snasphot API integrity error: uanble to find node "${nodeId}" in graph "${graphId}"`
            );
          }
          const ports = await node.ports();
          const changes = this.#mutable.ports.getChanges(
            graphId,
            nodeId,
            ports
          );
          this.#changes.addPorts(graphId, nodeId, changes);
          break;
        }
        default: {
          throw new Error(
            `Snapshot API integrity error: Unsupported pending type "${pending.type}"`
          );
        }
      }
    }
  }

  start(): void {
    this.#stale = false;

    const inspector = this.#mutable.graphs.get("");
    if (!inspector) {
      throw new Error(
        `Snapshot API Integrity error: no main graph for "${this.#mutable.graph.url}`
      );
    }
    // Restart if there are changes already.
    if (this.#changes.changes.length > 0) {
      this.#changes = new ChangeMaker([]);
      this.#stale = false;
    }

    this.rebuildSingleGraph(inspector, "");
    Object.entries(inspector.modules()).forEach(([id, module]) => {
      this.#changes.addModule(id, module);
    });
    Object.entries(inspector.graphs() || {}).forEach(([graphId, subgraph]) => {
      this.rebuildSingleGraph(subgraph, graphId);
    });
    // This will consume the first pending item in the pending queue,
    // so `pending` will almost never contain the entire pending queue
    // when read.
    this.update();
  }

  rebuildSingleGraph(
    inspector: InspectableGraph,
    graphId: GraphIdentifier
  ): void {
    this.#changes.addGraph(inspector.raw(), graphId);
    this.#changes.changeGraphMetadata(inspector.metadata(), graphId);
    if (!inspector.imperative()) {
      inspector.nodes().forEach((node) => {
        this.#changes.addNode(node.descriptor, graphId);
        this.#pending.push({
          type: "updateports",
          nodeId: node.descriptor.id,
          graphId,
        });
        this.#setStale();
      });
      inspector.edges().forEach((edge) => {
        this.#changes.addEdge(edge.raw(), graphId);
      });
    }
  }

  current(): InspectableMainGraphSnapshot {
    return this.#snapshot;
  }
}
