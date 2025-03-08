/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  GraphMetadata,
  JsonSerializable,
} from "@breadboard-ai/types";
import { EditableGraph, ok, Outcome } from "@google-labs/breadboard";
import { SideBoardRuntime } from "./types";

export { graphAutonamingTask };

async function graphAutonamingTask(
  runtime: SideBoardRuntime,
  editor: EditableGraph,
  graph: GraphDescriptor,
  graphId: GraphIdentifier,
  label: string
): Promise<Outcome<void>> {
  const outputs = await runtime.runTask({
    // TODO: The Autonaming Graph goes here
    graph: { nodes: [], edges: [] },
    context: [
      {
        parts: [{ json: graph as JsonSerializable }],
      },
    ],
  });
  if (!ok(outputs)) {
    // TODO: handle error somehow.
    return;
  }
  const part = outputs.at(0)?.parts.at(0);
  if (!(part && "json" in part)) {
    // TODO: handle error
    return;
  }
  const metadata: GraphMetadata = part.json as GraphMetadata;
  const result = await editor.edit(
    [{ type: "changegraphmetadata", metadata, graphId }],
    label
  );
  if (!result.success) {
    // TODO: handle error
    return;
  }
}
