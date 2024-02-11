/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  Schema,
} from "../types.js";
import { EdgeType } from "./schemas.js";
import {
  InspectableEdge,
  InspectableGraph,
  InspectableGraphLoader,
  InspectableNode,
  InspectableNodePorts,
  InspectablePortList,
  PortStatus,
} from "./types.js";

export const inspectableNode = (
  descriptor: NodeDescriptor,
  inspectableGraph: InspectableGraph
): InspectableNode => {
  return new Node(descriptor, inspectableGraph);
};

class Node implements InspectableNode {
  descriptor: NodeDescriptor;
  #graph: InspectableGraph;
  #incoming: InspectableEdge[] | undefined;
  #outgoing: InspectableEdge[] | undefined;

  constructor(descriptor: NodeDescriptor, graph: InspectableGraph) {
    this.descriptor = descriptor;
    this.#graph = graph;
  }

  incoming(): InspectableEdge[] {
    return (this.#incoming ??= this.#graph.incomingForNode(this.descriptor.id));
  }

  outgoing(): InspectableEdge[] {
    return (this.#outgoing ??= this.#graph.outgoingForNode(this.descriptor.id));
  }

  isEntry(): boolean {
    return this.incoming().length === 0;
  }

  isExit(): boolean {
    return this.outgoing().length === 0;
  }

  containsGraph(): boolean {
    // This is likely too naive, since map also invokes subgraphs.
    // TODO: Flesh this out some more.
    return this.descriptor.type === "invoke";
  }

  async subgraph(
    loader: InspectableGraphLoader
  ): Promise<InspectableGraph | undefined> {
    if (!this.containsGraph()) return undefined;

    // Find the subgraph
    type InvokeInputs = { graph: GraphDescriptor; path: string };
    // TODO: Support subgraphs that are dynamically loaded from values.
    const { graph, path } = this.configuration() as InvokeInputs;
    return await loader(graph ? graph : path, this.#graph.raw());
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    return this.#graph.describeType(this.descriptor.type, {
      inputs: { ...inputs, ...this.configuration() },
      incoming: this.incoming(),
      outgoing: this.outgoing(),
    });
  }

  async ports(inputValues?: InputValues): Promise<InspectableNodePorts> {
    const described = await this.describe(inputValues);
    const inputs: InspectablePortList = {
      fixed: described.inputSchema.additionalProperties === false,
      ports: collectPorts(
        EdgeType.In,
        this.incoming(),
        described.inputSchema,
        this.configuration()
      ),
    };
    const outputs: InspectablePortList = {
      fixed: described.outputSchema.additionalProperties === false,
      ports: collectPorts(
        EdgeType.Out,
        this.outgoing(),
        described.outputSchema
      ),
    };
    return { inputs, outputs };
  }
}

const computePortStatus = (
  wired: boolean,
  expected: boolean,
  required: boolean
): PortStatus => {
  if (wired) {
    return expected ? PortStatus.Connected : PortStatus.Dangling;
  }
  return required ? PortStatus.Missing : PortStatus.Ready;
};

const collectPorts = (
  type: EdgeType,
  edges: InspectableEdge[],
  schema: Schema,
  configuration?: NodeConfiguration
) => {
  // Get the list of all ports wired to this node.
  const wiredPortNames = edges.map((edge) => {
    if (edge.out === "*") return "*";
    return type === EdgeType.In ? edge.in : edge.out;
  });
  const schemaPortNames = Object.keys(schema.properties || {});
  const requiredPortNames = schema.required || [];
  const configuredPortNames = Object.keys(configuration || {});
  const portNames = [
    ...new Set([
      ...wiredPortNames,
      ...schemaPortNames,
      ...configuredPortNames,
      "*", // Always include the star port.
    ]),
  ];
  // TODO: Do something about the "schema" in the "output": it's a configured
  // value, but isn't an expected input. oops. Shows up as "Dangling".
  // TODO: When star is connected, all other ports are in a weird state: they
  // are "missing". They probably should be "wired" or "ready" instead?
  return portNames.map((port) => {
    const star = port === "*";
    const configured = configuredPortNames.includes(port);
    const wired = wiredPortNames.includes(port);
    const expected = schemaPortNames.includes(port) || star;
    const required = requiredPortNames.includes(port);
    return {
      name: port,
      configured,
      star,
      status: computePortStatus(wired || configured, expected, required),
      schema: schema.properties?.[port],
    };
  });
};
