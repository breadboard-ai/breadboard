/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createGraphStore,
  GraphDescriptor,
  GraphLoader,
  InspectableNode,
  InspectableNodePorts,
  Kit,
  PortStatus,
  Schema,
} from "@google-labs/breadboard";

async function generatePortSpec(
  node: InspectableNode,
  key: keyof InspectableNodePorts
): Promise<{ schema: Schema }> {
  const allPorts = await node.ports();
  const ports = [...allPorts[key].ports].filter((port) => {
    const inessentialPort =
      port.status === PortStatus.Ready && port.schema.required?.length === 0;
    if (
      port.name === "" ||
      port.name === "*" ||
      port.name === "$error" ||
      port.configured === true ||
      inessentialPort
    ) {
      return false;
    }

    return true;
  });

  const properties: Record<string, Schema> = {};
  for (const port of ports) {
    properties[port.name] = port.schema;

    // If there is a connected port we will want to visit the port of the
    // "from" node and use its schema for the input. Note: we only do this in
    // the case of inputs since the generated output node already uses the
    // targeted node's schema for its ports.
    if (port.status === PortStatus.Connected && key === "inputs") {
      // Infer from the incoming edge what the type should be. Start by finding
      // the edge and then querying the "from" node about the port's schema.
      const edge = port.edges.find(
        (edge) =>
          edge.to.descriptor.id === node.descriptor.id && edge.in === port.name
      );

      if (edge) {
        const { outputs } = await edge.from.ports();
        const outgoingPort = outputs.ports.find(
          (port) => port.name === edge.out
        );

        // Copy the outgoing port schema over the input port's schema.
        if (outgoingPort) {
          properties[port.name] = outgoingPort.schema;
        }
      }
    }
  }

  return {
    schema: {
      type: "object",
      properties,
    },
  };
}

export async function getIsolatedNodeGraphDescriptor(
  board: GraphDescriptor,
  kits: Kit[],
  loader: GraphLoader | undefined,
  nodeId: string
): Promise<GraphDescriptor | null> {
  const graphStore = createGraphStore({
    kits,
    loader: loader || {
      load: () => {
        throw new Error("Loader should not be used for isolated nodes");
      },
    },
    sandbox: {
      runModule: () => {
        throw new Error("Sandbox should not be used for isolated nodes.");
      },
    },
  });
  const adding = graphStore.addByDescriptor(board);
  if (!adding.success) {
    return null;
  }
  const breadboardGraph = graphStore.inspectAsync(adding.result, "");
  if (!breadboardGraph) {
    return null;
  }

  const node = breadboardGraph.nodeById(nodeId);
  if (!node) {
    return null;
  }

  if (node.type().type() === "input" || node.type().type() === "output") {
    return null;
  }

  const inputSchema = await generatePortSpec(node, "inputs");
  const outputSchema = await generatePortSpec(node, "outputs");
  const inputID = `input-${globalThis.crypto.randomUUID()}`;
  const outputID = `input-${globalThis.crypto.randomUUID()}`;

  const inputEdges = Object.keys(inputSchema.schema.properties ?? {}).map(
    (port) => {
      return {
        from: inputID,
        to: nodeId,
        out: port,
        in: port,
      };
    }
  );
  const outputEdges = Object.keys(outputSchema.schema.properties ?? {}).map(
    (port) => {
      return {
        from: nodeId,
        to: outputID,
        out: port,
        in: port,
      };
    }
  );

  const descriptor = {
    title: `${nodeId} - Isolated Node Board`,
    description: `A board that isolates ${nodeId}`,
    version: "0.0.1",
    edges: [...inputEdges, ...outputEdges],
    nodes: [
      {
        type: "input",
        id: inputID,
        metadata: {
          title: `Input for ${node.title()}`,
        },
        configuration: {
          schema: inputSchema.schema,
        },
      },
      node.descriptor,
      {
        type: "output",
        id: outputID,
        metadata: {
          title: `Output for ${node.title()}`,
        },
        configuration: {
          schema: outputSchema.schema,
        },
      },
    ],
  };

  return descriptor;
}
