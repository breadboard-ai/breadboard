/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { transformConfiguration } from "./transform-all-nodes.js";
import { ROUTE_TOOL_PATH } from "../../a2/a2/tool-manager.js";

export { MarkInPortsInvalid };

class MarkInPortsInvalid implements EditTransform {
  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly from: NodeIdentifier,
    public readonly to: NodeIdentifier
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;
    const inspectable = context.mutable.graphs.get(graphId);
    if (!inspectable)
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };

    const node = inspectable.nodeById(this.to);
    if (!node) {
      return {
        success: false,
        error: `Unable to find the "to" node by id "${this.to}"`,
      };
    }
    const edits: EditSpec[] = [];

    const newToConfig = transformConfiguration(
      this.to,
      node.configuration(),
      (part) => {
        const { path } = part;
        if (path === this.from) {
          return { ...part, invalid: true };
        }
        return null;
      }
    );
    if (newToConfig !== null) {
      edits.push({
        type: "changeconfiguration",
        id: this.to,
        configuration: newToConfig,
        reset: true,
        graphId,
      });
    }

    // Check to see if the "from" node has any routes. And if so, mark the corresponding chips as invalid.
    const fromNode = inspectable.nodeById(this.from);
    if (!fromNode) {
      return {
        success: false,
        error: `Unable to find the "from" node by id "${this.from}"`,
      };
    }

    const newFromConfig = transformConfiguration(
      this.from,
      fromNode.configuration(),
      (part) => {
        const { path, type, instance } = part;
        if (
          path === ROUTE_TOOL_PATH &&
          type === "tool" &&
          instance === this.to
        ) {
          return { ...part, invalid: true };
        }
        return null;
      }
    );
    if (newFromConfig !== null) {
      edits.push({
        type: "changeconfiguration",
        id: this.from,
        configuration: newFromConfig,
        reset: true,
        graphId,
      });
    }

    return context.apply(edits, `Marking "${this.from}" in port as invalid`);
  }
}
