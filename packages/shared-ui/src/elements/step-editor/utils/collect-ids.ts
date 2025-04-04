/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AssetPath,
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { Graph } from "../graph";
import { GraphNode } from "../graph-node";
import { PortIdentifier } from "@google-labs/breadboard";
import { GraphEdge } from "../graph-edge";
import { GraphAsset } from "../graph-asset";

export function collectEdgeAndGraphId(evt: Event) {
  let graphId: GraphIdentifier | null = null;
  let edgeId: string | null = null;

  const path = evt.composedPath();

  for (const el of path) {
    if (el instanceof Graph && !graphId) {
      graphId = el.graphId;
    }

    if (el instanceof GraphEdge && !edgeId) {
      edgeId = el.edgeId;
    }

    if (edgeId && graphId) {
      break;
    }
  }

  return { graphId, edgeId };
}

export function collectNodeAndGraphId(evt: Event) {
  let graphId: GraphIdentifier | null = null;
  let nodeId: NodeIdentifier | null = null;

  const path = evt.composedPath();

  for (const el of path) {
    if (el instanceof Graph && !graphId) {
      graphId = el.graphId;
    }

    if (el instanceof GraphNode && !nodeId) {
      nodeId = el.nodeId;
    }

    if (nodeId && graphId) {
      break;
    }
  }

  return { graphId, nodeId };
}

export function collectNodeIds(evt: Event, dir: "in" | "out") {
  let graphId: GraphIdentifier | null = null;
  let nodeId: NodeIdentifier | null = null;
  let portId: PortIdentifier | null = null;

  const path = evt.composedPath();

  for (const el of path) {
    if (el instanceof Graph && !graphId) {
      graphId = el.graphId;
    }

    if (el instanceof GraphNode) {
      if (!nodeId) {
        nodeId = el.nodeId;
      }

      if (el.ports && !portId) {
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

export function collectAssetIds(evt: Event) {
  let graphId: GraphIdentifier | null = null;
  let assetPath: AssetPath | null = null;

  const path = evt.composedPath();

  for (const el of path) {
    if (el instanceof Graph && !graphId) {
      graphId = el.graphId;
    }

    if (el instanceof GraphAsset) {
      if (!assetPath) {
        assetPath = el.assetPath;
      }
    }

    if (assetPath && graphId) {
      break;
    }
  }

  return { graphId, assetPath };
}
