/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  InspectableEdgeType,
  InspectablePort,
  NodeIdentifier,
} from "@google-labs/breadboard";
import {
  ReferenceIdentifier,
  WorkspaceSelectionState,
  type EdgeData,
  type GraphSelectionState,
} from "../../types/types.js";
import { ComponentExpansionState, VisualMetadata } from "./types.js";

const documentStyles = getComputedStyle(document.documentElement);

type ValidColorStrings = `#${number}` | `--${string}`;

export function getGlobalColor(
  name: ValidColorStrings,
  defaultValue: ValidColorStrings = "#333333"
) {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  const valueAsNumber = parseInt(value || defaultValue, 16);
  if (Number.isNaN(valueAsNumber)) {
    return 0xff00ff;
  }
  return valueAsNumber;
}

export function inspectableEdgeToString(edge: EdgeData): string {
  return `${edge.from.descriptor.id}:${edge.out}->${edge.to.descriptor.id}:${edge.in}`;
}

export function edgeToString(edge: Edge): string {
  const fakeEdge = {
    from: {
      descriptor: {
        id: edge.from,
      },
    },
    to: {
      descriptor: {
        id: edge.to,
      },
    },
    out: edge.out,
    in: edge.in,
    type: InspectableEdgeType.Ordinary,
  };
  return inspectableEdgeToString(fakeEdge as EdgeData);
}

export const DBL_CLICK_DELTA = 450;

export function isConfigurablePort(
  port: InspectablePort,
  expansionState: ComponentExpansionState = "expanded"
): boolean {
  if (port.star) return false;
  if (port.name === "") return false;

  if (expansionState === "advanced") return true;

  if (port.schema.behavior?.includes("config")) return true;
  const items = port.schema.items;
  if (items && !Array.isArray(items) && items.behavior?.includes("config")) {
    return true;
  }

  return false;
}

export function computeNextExpansionState(
  state: ComponentExpansionState
): ComponentExpansionState {
  switch (state) {
    case "expanded":
      return "advanced";
    case "collapsed":
      return "expanded";
    case "advanced":
      return "collapsed";
    default:
      return "expanded";
  }
}

export function expansionStateFromMetadata(
  collapsed: VisualMetadata["collapsed"],
  collapseNodesByDefault: boolean
): ComponentExpansionState {
  if (typeof collapsed === "boolean") {
    return collapsed ? "collapsed" : "expanded";
  } else {
    return collapsed ?? (collapseNodesByDefault ? "collapsed" : "expanded");
  }
}

export function createRandomID(type: string) {
  const randomId = globalThis.crypto.randomUUID();
  const nextNodeId = randomId.split("-");
  // Now that types could be URLs, we need to make them a bit
  // less verbose.
  if (type.includes(":") || type.includes("#")) {
    // probably a URL, so let's create a nice short name from the URL
    try {
      const url = new URL(type);
      const name = url.pathname
        .split("/")
        .pop()
        ?.replace(".bgl.json", "")
        .slice(0, 15);
      if (name) {
        return `${name}-${nextNodeId[0]}`;
      }
    } catch (e) {
      // Ignore.
    }
    return `board-${nextNodeId[0]}`;
  }
  // TODO: Check for clashes
  return `${type}-${nextNodeId[0]}`;
}

export function emptyWorkspaceSelectionState(): WorkspaceSelectionState {
  return {
    graphs: new Map(),
    modules: new Set(),
  };
}

export function emptySelectionState(): GraphSelectionState {
  return {
    nodes: new Set<NodeIdentifier>(),
    comments: new Set<string>(),
    edges: new Set<string>(),
    references: new Set<ReferenceIdentifier>(),
  };
}
