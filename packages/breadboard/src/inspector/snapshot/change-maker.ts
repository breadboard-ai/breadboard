/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  GraphInlineMetadata,
  GraphMetadata,
} from "@breadboard-ai/types";
import { SnapshotChangeSpec } from "./types.js";

export { ChangeMaker };

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

  newGraph(graph: GraphDescriptor, graphId: GraphIdentifier) {
    type Copyable = Record<string, unknown>;
    const metadata: GraphInlineMetadata = {};
    ["$schema", "url", "title", "description", "version"].forEach((key) => {
      if (key in graph) {
        (metadata as Copyable)[key] = (graph as Copyable)[key];
      }
    });

    this.changes.push({
      type: "newgraph",
      metadata,
      graphId,
    });
  }
}
