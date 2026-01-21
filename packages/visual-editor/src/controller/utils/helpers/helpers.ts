/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge, InspectableAssetEdge } from "@breadboard-ai/types";
import { AssetEdgeIdentifier, EdgeIdentifier } from "../../types.js";

export function toEdgeIdentifier(edge: Edge): EdgeIdentifier {
  const edgeIn = edge.out === "*" ? "*" : edge.in;
  return `${edge.from}:${edge.out}->${edge.to}:${edgeIn}`;
}

export function toAssetEdgeIdentifier(
  edge: InspectableAssetEdge
): AssetEdgeIdentifier {
  return `${edge.assetPath}->${edge.node.descriptor.id}:${edge.direction}`;
}
