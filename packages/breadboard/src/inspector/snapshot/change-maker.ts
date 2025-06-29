/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  GraphIdentifier,
  GraphInlineMetadata,
  GraphMetadata,
  InspectableModule,
  Module,
  ModuleIdentifier,
  NodeDescriptor,
  NodeIdentifier,
  NodePortChanges,
} from "@breadboard-ai/types";
import { timestamp } from "../../timestamp.js";
import { hash } from "../../utils/hash.js";
import type { SnapshotAddGraphSpec, SnapshotChangeSpec } from "./types.js";

export { ChangeMaker };

const INLINE_METADATA_PROPS: readonly (keyof GraphInlineMetadata)[] = [
  "$schema",
  "url",
  "title",
  "description",
  "version",
] as const;

const MODULE_PROPS: readonly (keyof Module)[] = ["code", "metadata"] as const;

const ADD_GRAPH_PROPS: readonly (keyof SnapshotAddGraphSpec)[] = [
  "type",
  "metadata",
  "graphId",
  "main",
];

class ChangeMaker {
  constructor(public readonly changes: SnapshotChangeSpec[]) {}

  changeGraphMetadata(
    metadata: GraphMetadata | undefined,
    graphId: GraphIdentifier
  ) {
    if (!metadata) return;
    this.changes.push({
      type: "changegraphmetadata",
      metadata,
      graphId,
      timestamp: timestamp(),
    });
  }

  addNode(node: NodeDescriptor, graphId: GraphIdentifier) {
    this.changes.push({
      type: "addnode",
      node,
      graphId,
      timestamp: timestamp(),
    });
  }

  addEdge(edge: Edge, graphId: GraphIdentifier) {
    const id = hash(edge);
    this.changes.push({
      type: "addedge",
      edge,
      graphId,
      id,
      timestamp: timestamp(),
    });
  }

  addModule(id: ModuleIdentifier, module: InspectableModule) {
    this.changes.push({
      type: "addmodule",
      id,
      module: copy(MODULE_PROPS, module),
      timestamp: timestamp(),
    });
  }

  addGraph(graph: GraphDescriptor, graphId: GraphIdentifier) {
    this.changes.push(
      copy(ADD_GRAPH_PROPS, {
        type: "addgraph",
        metadata: copy(INLINE_METADATA_PROPS, graph),
        graphId,
        main: graph.main,
        timestamp: timestamp(),
      })
    );
  }

  addPorts(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    changes: NodePortChanges
  ) {
    this.changes.push({
      type: "updateports",
      graphId,
      nodeId,
      timestamp: timestamp(),
      ...changes,
    });
  }
}

type Copyable = Record<string, unknown>;
function copy<
  S extends Copyable,
  D extends Copyable,
  P extends readonly string[],
>(props: P, source: S): D {
  const result: Partial<D> = {};
  props.forEach((key) => {
    if (!(key in source)) return;
    let o = (source as Copyable)[key];
    if (typeof o === "function") o = o.call(source);
    if (o !== null && typeof o === "object" && Object.keys(o).length === 0)
      return;
    if (o === undefined) return;
    if (key in source) {
      (result as Copyable)[key] = o;
    }
  });
  return result as D;
}
