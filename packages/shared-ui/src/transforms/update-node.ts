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
import { UpdateParameterMetadata } from "./update-parameter-metadata";

export { UpdateNode };

class UpdateNode implements EditTransform {
  public titleUserModified = false;

  constructor(
    public readonly id: NodeIdentifier,
    public readonly graphId: GraphIdentifier,
    public readonly configuration: NodeConfiguration | null,
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

    const edits: EditSpec[] = [];

    if (configuration) {
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

      edits.push({
        type: "changeconfiguration",
        id: id,
        configuration: updatedConfiguration,
        reset: true,
        graphId,
      });
    }

    let titleChanged = false;

    const existingMetadata = inspectableNode?.metadata() || {};
    this.titleUserModified = !!existingMetadata.userModified;
    if (metadata) {
      titleChanged = !!(
        metadata.userModified ||
        (metadata.title && existingMetadata.title !== metadata.title)
      );
      if (titleChanged) {
        this.titleUserModified = true;
      }
      const newMetadata: NodeMetadata = {
        ...existingMetadata,
        ...metadata,
        userModified: this.titleUserModified,
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

    if (portsToAutowire) {
      const autowiring = await new AutoWireInPorts(
        id,
        graphId,
        portsToAutowire
      ).apply(context);
      if (!autowiring.success) return autowiring;
    }

    const updatingParameterMetadata = await new UpdateParameterMetadata(
      graphId
    ).apply(context);
    if (!updatingParameterMetadata.success) return updatingParameterMetadata;

    if (!titleChanged) return { success: true };

    return new UpdateNodeTitle(this.graphId, id, metadata!.title!).apply(
      context
    );
  }
}
