/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphDescriptor,
  GraphIdentifier,
  GraphInlineMetadata,
  GraphMetadata,
  NodeDescriptor,
} from "@breadboard-ai/types";
import { SnapshotChangeSpec } from "./types.js";
import { hash } from "../../utils/hash.js";

export { ChangeMaker };

const INLINE_METADATA_PROPS: readonly (keyof GraphInlineMetadata)[] = [
  "$schema",
  "url",
  "title",
  "description",
  "version",
] as const;

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
    });
  }

  addNode(node: NodeDescriptor, graphId: GraphIdentifier) {
    this.changes.push({ type: "addnode", node, graphId });
  }

  addEdge(edge: Edge, graphId: GraphIdentifier) {
    const id = hash(edge);
    this.changes.push({ type: "addedge", edge, graphId, id });
  }

  newGraph(graph: GraphDescriptor, graphId: GraphIdentifier) {
    type Copyable = Record<string, unknown>;
    const metadata: GraphInlineMetadata = {};
    INLINE_METADATA_PROPS.forEach((key) => {
      if (key in graph) {
        (metadata as Copyable)[key] = (graph as Copyable)[key];
      }
    });

    this.changes.push({
      type: "addgraph",
      metadata,
      graphId,
    });
  }
}
