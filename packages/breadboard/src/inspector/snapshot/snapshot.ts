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
} from "./types.js";

export { Snapshot };

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

class Snapshot
  extends (EventTarget as SnapshotEventTarget)
  implements InspectableSnapshot
{
  #mutable: MutableGraph;
  #changes!: ChangeMaker;
  #snapshot: Mutable<InspectableMainGraphSnapshot>;

  constructor(mutable: MutableGraph) {
    super();
    this.#mutable = mutable;
    this.rebuildChanges();
    this.#snapshot = this.rebuild();
  }

  get changes(): SnapshotChangeSpec[] {
    return this.#changes.changes;
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
