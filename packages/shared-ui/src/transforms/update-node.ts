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
import { UpdateNodeTitle } from "./update-node-title";

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

    let titleChanged = false;

    if (metadata) {
      const existingMetadata = inspectableNode?.metadata() || {};
      titleChanged = !!(
        metadata.title && existingMetadata.title !== metadata.title
      );
      const newMetadata: NodeMetadata = {
        userModified: titleChanged,
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
    const autowiring = await new AutoWireInPorts(
      id,
      graphId,
      portsToAutowire
    ).apply(context);
    if (!autowiring.success) return autowiring;

    if (!titleChanged) return { success: true };

    return new UpdateNodeTitle(this.graphId, id, metadata!.title!).apply(
      context
    );
  }
}
