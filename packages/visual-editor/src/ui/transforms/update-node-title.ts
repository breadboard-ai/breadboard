/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { AutoWireInPorts } from "./autowire-in-ports.js";
import { TransformAllNodes } from "./transform-all-nodes.js";
import { ROUTE_TOOL_PATH } from "../../a2/a2/tool-manager.js";

export { UpdateNodeTitle };

class UpdateNodeTitle implements EditTransform {
  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly nodeId: NodeIdentifier,
    public readonly title: string
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;

    // Track which nodes had a type: "in" reference to this node.
    // Only those nodes need their autowire edges updated via AutoWireInPorts.
    // Routing chiclets (type: "tool") may also match for title updates,
    // but should NOT trigger AutoWireInPorts (they are routes, not in-ports).
    const nodesWithInRef = new Set<NodeIdentifier>();

    return new TransformAllNodes(
      graphId,
      (part, nodeId) => {
        const { type, path, instance } = part;
        if (type === "in" && path === this.nodeId) {
          nodesWithInRef.add(nodeId);
          return { type, path, title: this.title };
        }
        if (
          type === "tool" &&
          path === ROUTE_TOOL_PATH &&
          instance === this.nodeId
        ) {
          return { ...part, title: this.title };
        }
        return null;
      },
      "Updating Node Titles in @-references.",
      (id) => {
        if (!nodesWithInRef.has(id)) return null;
        return new AutoWireInPorts(
          id,
          graphId,
          [{ path: this.nodeId, title: this.title }],
          true
        );
      }
    ).apply(context);
  }
}
