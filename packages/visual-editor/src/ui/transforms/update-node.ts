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
} from "@breadboard-ai/types";
import { AutoWireInPorts, InPort } from "./autowire-in-ports.js";
import { UpdateNodeTitle } from "./update-node-title.js";
import { UpdateParameterMetadata } from "./update-parameter-metadata.js";
import { routesFromConfiguration } from "../../utils/control.js";
import { ChangeEdgesToBroadcastMode } from "./change-edges-to-broadcast-mode.js";
import { ChangeEdgesToRoutingMode } from "./change-edges-to-routing-mode.js";

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

    let outWireTransform: EditTransform | null = null;

    if (configuration) {
      const newRoutes = routesFromConfiguration(configuration);
      const existingRoutes = inspectableNode.routes();
      if (newRoutes.length === 0 && existingRoutes.length > 0) {
        // Mode change: "routing" -> "broadcast"
        console.log("MODE CHANGE: Routing -> Broadcast");
        outWireTransform = new ChangeEdgesToBroadcastMode(id, graphId);
      } else if (newRoutes.length > 0) {
        // Ensure all route targets have outgoing edges.
        // Handles broadcast->routing transition, adding new routes while
        // already in routing mode, and loaded graphs with missing edges.
        outWireTransform = new ChangeEdgesToRoutingMode(
          id,
          graphId,
          configuration
        );
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
      if (metadata.title) {
        if (
          metadata.userModified ||
          existingMetadata.title !== metadata.title
        ) {
          titleChanged = true;
        }
      }
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
      });
    }

    const editResult = await context.apply(
      edits,
      `Change partial configuration for "${id}"`
    );
    if (!editResult.success) return editResult;

    if (outWireTransform) {
      const outWireResult = await outWireTransform.apply(context);
      if (!outWireResult.success) return outWireResult;
    }

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
