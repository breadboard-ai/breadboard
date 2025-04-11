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
} from "@google-labs/breadboard";

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

    const incoming = dedupeEdges(
      ins
        .map((v) => {
          const out = getDefaultOutputPort(inspectableGraph.nodeById(v.path));
          if (!out) return null;
          return {
            from: v.path,
            to: inspectableNode.descriptor.id,
            out,
            in: `p-z-${v.path}`,
          };
        })
        .filter(Boolean) as Edge[]
    );
    console.group("UPDATE AUTOWIRES");
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
      edits.push({
        type: "addedge",
        edge,
        graphId,
      });
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

    return context.apply(edits, "Autowiring incoming ports");
  }
}

function dedupeEdges(edges: Edge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = edgeKey(edge);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeEdgeDiff(current: Edge[], incoming: Edge[]) {
  const currentMap = new Map<string, Edge>();
  const incomingMap = new Map<string, Edge>();

  current.forEach((edge) => {
    currentMap.set(edgeKey(edge), edge);
  });
  incoming.forEach((edge) => {
    incomingMap.set(edgeKey(edge), edge);
  });

  const toDelete: Edge[] = [];
  const toInsert: Edge[] = [];

  current.forEach((edge) => {
    const key = edgeKey(edge);
    if (!incomingMap.has(key)) {
      toDelete.push(edge);
    }
  });

  incoming.forEach((edge) => {
    const key = edgeKey(edge);
    if (!currentMap.has(key)) {
      toInsert.push(edge);
    }
  });

  return { toInsert, toDelete };
}

function edgeKey({ metadata: _m, ...rest }: Edge) {
  return JSON.stringify(rest);
}

function getDefaultOutputPort(from: InspectableNode | undefined) {
  if (!from) return;
  const ports = from.currentPorts().outputs.ports;
  const mainPort = ports.find((port) =>
    port.schema.behavior?.includes("main-port")
  );
  if (mainPort) return mainPort.name;
  return ports.find((port) => !port.star && !port.name.startsWith("$"))?.name;
}
