/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  InspectableNode,
  NodeIdentifier,
  PortStatus,
} from "@breadboard-ai/types";
import { willCreateCycle } from "@breadboard-ai/utils";
import { transformConfiguration } from "./transform-all-nodes.js";
import { computeEdgeDiff, dedupeEdges } from "../../utils/edge-operations.js";

export { AutoWireInPorts };

export type InPort = { path: string; title: string };

class AutoWireInPorts implements EditTransform {
  constructor(
    public readonly id: NodeIdentifier,
    public readonly graphId: GraphIdentifier,
    public readonly ports: InPort[],
    public readonly updateOnly: boolean = false
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const ins = this.ports;
    const graphId = this.graphId;
    const id = this.id;

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

    const invalidReferences: NodeIdentifier[] = [];

    const incoming = dedupeEdges(
      ins
        .map((v) => {
          const receiver = inspectableNode.descriptor.id;
          const out = getDefaultOutputPort(
            inspectableGraph.nodeById(v.path),
            receiver
          );
          if (!out) {
            invalidReferences.push(v.path);
            return null;
          }
          return {
            from: v.path,
            to: receiver,
            out,
            in: `p-z-${v.path}`,
          };
        })
        .filter(Boolean) as Edge[]
    );
    console.log("AUTOWIRES INVALID REFS", invalidReferences);

    console.groupCollapsed("UPDATE AUTOWIRES");
    console.log("Icoming:");
    console.table(incoming);

    const current = inspectableNode
      .currentPorts()
      .inputs.ports.filter(
        (port) =>
          !port.star &&
          port.status == PortStatus.Connected &&
          port.name.startsWith("p-z-")
      )
      .flatMap((port) => port.edges?.map((edge) => edge.raw()) || []);
    console.log("Current:");
    console.table(current);

    const diff = computeEdgeDiff(current, incoming);
    console.log("Insert:");
    console.table(diff.toInsert);
    console.log("Delete:");
    console.table(diff.toDelete);
    console.groupEnd();

    const edits: EditSpec[] = [];

    diff.toInsert.forEach((edge) => {
      if (willCreateCycle(edge, inspectableGraph.raw())) {
        invalidReferences.push(edge.from);
        return;
      }
      edits.push({ type: "addedge", edge, graphId });
    });

    if (!this.updateOnly) {
      diff.toDelete.forEach((edge) => {
        edits.push({
          type: "removeedge",
          edge,
          graphId,
        });
      });
    }

    if (invalidReferences.length > 0) {
      const id = inspectableNode.descriptor.id;
      const updatedConfiguration = transformConfiguration(
        id,
        inspectableNode.configuration(),
        (part) => {
          if (part.type !== "in") return null;
          if (invalidReferences.includes(part.path)) {
            return { ...part, invalid: true };
          }
          return null;
        }
      );
      if (updatedConfiguration !== null) {
        edits.push({
          type: "changeconfiguration",
          configuration: updatedConfiguration,
          graphId,
          id,
        });
      }
    }

    return context.apply(edits, "Autowiring incoming ports");
  }
}

function getDefaultOutputPort(
  from: InspectableNode | undefined,
  receiver: NodeIdentifier
) {
  if (!from) return;
  if (from.routes().length > 0) {
    return receiver;
  }
  const ports = from.currentPorts().outputs.ports;
  const mainPort = ports.find((port) =>
    port.schema.behavior?.includes("main-port")
  );
  if (mainPort) return mainPort.name;
  return ports.find((port) => !port.star && !port.name.startsWith("$"))?.name;
}
