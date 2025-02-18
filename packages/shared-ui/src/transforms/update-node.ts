/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeMetadata } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeConfiguration,
  NodeIdentifier,
} from "@google-labs/breadboard";
import { AutoWireInPorts, InPort } from "./autowire-in-ports";

export { UpdateNode };

class UpdateNode implements EditTransform {
  constructor(
    public readonly id: NodeIdentifier,
    public readonly graphId: GraphIdentifier,
    public readonly configuration: NodeConfiguration,
    public readonly metadata: NodeMetadata | null,
    public readonly portsToAutowire: InPort[] | null
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { graphId, id, configuration, metadata, portsToAutowire } = this;

    const inspectableGraph = context.mutable.graphs.get(graphId);
    if (!inspectableGraph)
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };

    const inspectableNode = inspectableGraph.nodeById(id);
    if (!inspectableNode) {
      return { success: false, error: `Unable to find node with id "${id}"` };
    }

    const existingConfiguration =
      inspectableNode?.descriptor.configuration ?? {};
    const updatedConfiguration = structuredClone(existingConfiguration);
    for (const [key, value] of Object.entries(configuration)) {
      if (value === null || value === undefined) {
        delete updatedConfiguration[key];
        continue;
      }

      updatedConfiguration[key] = value;
    }

    const edits: EditSpec[] = [
      {
        type: "changeconfiguration",
        id: id,
        configuration: updatedConfiguration,
        reset: true,
        graphId,
      },
    ];

    if (metadata) {
      const existingMetadata = inspectableNode?.metadata() || {};
      const newMetadata = {
        ...existingMetadata,
        ...metadata,
      };

      edits.push({
        type: "changemetadata",
        id,
        metadata: newMetadata,
        graphId,
      }),
        `Change metadata for "${id}"`;
    }

    const editResult = await context.apply(
      edits,
      `Change partial configuration for "${id}"`
    );
    if (!editResult.success) return editResult;

    if (!portsToAutowire) {
      return { success: true };
    }
    const autowire = new AutoWireInPorts(id, graphId, portsToAutowire);
    return autowire.apply(context);
  }
}
