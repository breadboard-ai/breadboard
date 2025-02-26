/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier, NodeMetadata } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  NodeConfiguration,
  NodeIdentifier,
  NodeTypeIdentifier,
  PortIdentifier,
} from "@google-labs/breadboard";

export { CreateNode };

export type CreateNodeOptions = {
  sourceId: NodeIdentifier;
  portId: PortIdentifier;
};

class CreateNode implements EditTransform {
  constructor(
    public readonly id: NodeIdentifier,
    public readonly graphId: GraphIdentifier,
    public readonly nodeType: NodeTypeIdentifier,
    public readonly configuration: NodeConfiguration | null,
    public readonly metadata: NodeMetadata | null,
    public readonly options: CreateNodeOptions | null
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { id, graphId, nodeType, options } = this;
    let { metadata, configuration } = this;

    const inspectableGraph = context.mutable.graphs.get(graphId);
    if (!inspectableGraph)
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };

    const typeMetadata = await inspectableGraph.typeById(nodeType)?.metadata();
    if (!typeMetadata) {
      return {
        success: false,
        error: `Unknown type: ${nodeType}`,
      };
    }

    const title = typeMetadata.title;
    if (title) {
      metadata ??= {};
      metadata.title = title;
    }

    if (!configuration && typeMetadata.example) {
      configuration = typeMetadata.example;
    }

    const newNode = {
      id,
      type: nodeType,
      metadata: metadata || undefined,
      configuration: configuration || undefined,
    };

    // Comment nodes are stored in the metadata for the graph
    if (nodeType === "comment") {
      if (!metadata) {
        return { success: false, error: `No metadata supplied for comment` };
      }

      const graphMetadata = inspectableGraph.metadata() || {};
      graphMetadata.comments = graphMetadata.comments || [];
      graphMetadata.comments.push({
        id,
        text: "",
        metadata,
      });

      return context.apply(
        [{ type: "changegraphmetadata", metadata: graphMetadata, graphId }],
        `Change metadata for graph - add comment "${id}"`
      );
    }

    const edits: EditSpec[] = [{ type: "addnode", node: newNode, graphId }];

    if (options) {
      const { sourceId, portId } = options;
      edits.push({
        type: "addedge",
        graphId,
        edge: {
          from: sourceId,
          to: id,
          out: portId,
          in: portId,
        },
      });
    }

    return context.apply(edits, `Add node ${id}`);
  }
}
