/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import { Graph } from "../graph";
import { GraphNode } from "../graph-node";
import { PortIdentifier } from "@google-labs/breadboard";

export function collectIds(evt: Event, dir: "in" | "out") {
  let graphId: GraphIdentifier | null = null;
  let nodeId: NodeIdentifier | null = null;
  let portId: PortIdentifier | null = null;
  const path = evt.composedPath();
  for (const el of path) {
    if (el instanceof Graph) {
      graphId = el.graphId;
    }

    if (el instanceof GraphNode) {
      nodeId = el.nodeId;

      if (el.ports) {
        const ports = dir === "in" ? el.ports.inputs : el.ports.outputs;

        for (const port of ports.ports) {
          if (port.schema.behavior?.includes("main-port")) {
            portId = port.name;
          }
        }
      }
    }

    if (nodeId && graphId && portId) {
      break;
    }
  }

  return { graphId, nodeId, portId };
}
