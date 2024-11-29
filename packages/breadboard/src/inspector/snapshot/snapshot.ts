/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableNodeType,
  MutableGraph,
} from "../types.js";
import { ChangeMaker } from "./change-maker.js";
import {
  InspectableEdgeSnapshot,
  InspectableMainGraphSnapshot,
  InspectableNodeSnapshot,
  InspectableSnapshot,
  SnapshotChangeSpec,
  SnapshotEventTarget,
  SnapshotPendingUpdate,
} from "./types.js";
import { PortUpdateReconciler } from "./port-update-reconciler.js";

export { Snapshot };

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

class Snapshot
  extends (EventTarget as SnapshotEventTarget)
  implements InspectableSnapshot
{
  #mutable: MutableGraph;
  #changes!: ChangeMaker;
  #snapshot: Mutable<InspectableMainGraphSnapshot>;
  readonly #pending: SnapshotPendingUpdate[] = [];
  readonly #portUpdateReconciler: PortUpdateReconciler =
    new PortUpdateReconciler();

  constructor(mutable: MutableGraph) {
    super();
    this.#mutable = mutable;
    this.rebuildChanges();
    this.#snapshot = this.rebuild();
  }

  get changes(): SnapshotChangeSpec[] {
    return this.#changes.changes;
  }

  get pending(): readonly SnapshotPendingUpdate[] {
    return this.#pending;
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
    // if stale, start an update using the update queue.
    // the update queue has all the pending things that should
    // be updated, but won't be until this function is called.
    for (;;) {
      const pending = this.#pending.shift();
      if (!pending) break;
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
          const changes = this.#portUpdateReconciler.getChanges(
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

  rebuildChanges(): void {
    const inspector = this.#mutable.graphs.get("");
    if (!inspector) {
      throw new Error(
        `Snapshot API Integrity error: no main graph for "${this.#mutable.graph.url}`
      );
    }
    this.#changes = new ChangeMaker([]);

    this.rebuildSingleGraph(inspector, "");
    Object.entries(inspector.modules()).forEach(([id, module]) => {
      this.#changes.addModule(id, module);
    });
    Object.entries(inspector.graphs() || {}).forEach(([graphId, subgraph]) => {
      this.rebuildSingleGraph(subgraph, graphId);
    });
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
      });
      inspector.edges().forEach((edge) => {
        this.#changes.addEdge(edge.raw(), graphId);
      });
    }
  }

  rebuild(): Mutable<InspectableMainGraphSnapshot> {
    const inspector = this.#mutable.graphs.get("");
    if (!inspector) {
      throw new Error(
        `Snapshot API Integrity error: no main graph for "${this.#mutable.graph.url}`
      );
    }
    const nodes: InspectableNodeSnapshot[] = inspector.nodes().map((node) => {
      return {
        descriptor: node.descriptor,
        title: node.title(),
        description: node.description(),
        incoming: toEdgeSnapshots(node.incoming()),
        outgoing: toEdgeSnapshots(node.outgoing()),
        isEntry: node.isEntry(),
        isExit: node.isExit(),
        type: toNodeTypeSnapshot(node.type()),
        configuration: node.configuration(),
        metadata: node.metadata(),
        ports: {
          inputs: {
            fixed: false,
            ports: [],
          },
          outputs: {
            fixed: false,
            ports: [],
          },
          side: {
            fixed: false,
            ports: [],
          },
        },
      };
    });
    const edges: InspectableEdgeSnapshot[] = toEdgeSnapshots(inspector.edges());

    return {
      metadata: inspector.metadata(),
      nodes,
      edges,
      kits: [],
      graphs: {},
      modules: {},
      imperative: inspector.imperative(),
      main: inspector.main(),
    };
  }

  current(): InspectableMainGraphSnapshot {
    return this.#snapshot;
  }
}

function toNodeTypeSnapshot(type: InspectableNodeType) {
  return { metadata: undefined, type: type.type(), ports: undefined };
}

function toEdgeSnapshots(edges: InspectableEdge[]) {
  return edges.map((edge) => {
    const raw = edge.raw();
    return { ...raw, type: edge.type };
  });
}
