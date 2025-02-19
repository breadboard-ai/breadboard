/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
} from "@google-labs/breadboard";

export { ChangeEdge };

export type ChangeType = "add" | "remove" | "move";

class ChangeEdge implements EditTransform {
  constructor(
    public readonly changeType: ChangeType,
    public readonly graphId: GraphIdentifier,
    public readonly from: Edge,
    public readonly to?: Edge
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    let changing: EditTransformResult;
    switch (this.changeType) {
      case "add": {
        const { graphId, from } = this;
        changing = await context.apply(
          [{ type: "addedge", edge: from, graphId: graphId }],
          `Add edge between ${from.from} and ${from.to}`
        );
        break;
      }

      case "remove": {
        const { graphId, from } = this;
        changing = await context.apply(
          [{ type: "removeedge", edge: from, graphId }],
          `Remove edge between ${from.from} and ${from.to}`
        );
        break;
      }

      case "move": {
        const { graphId, from, to } = this;
        if (!to) {
          return {
            success: false,
            error: "Unable to move edge - no `to` provided",
          };
        }

        changing = await context.apply(
          [
            {
              type: "changeedge",
              from: from,
              to: to,
              graphId,
            },
          ],
          `Change edge from between ${from.from} and ${from.to} to ${to.from} and ${to.to}`
        );
        break;
      }
    }
    return changing;
  }
}
