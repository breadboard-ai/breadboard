/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts `GraphDescriptor` to Mermaid format
 */

import type {
  Edge,
  GraphDescriptor,
  NodeDescriptor,
  SubGraphs,
} from "./types.js";

const template = (edges: string, direction: string) => {
  return `%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph ${direction};
${edges}
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef config stroke:#a64d79,fill:#ead1dcff,color:#000
classDef secrets stroke:#db4437,fill:#f4cccc,color:#000
classDef slotted stroke:#a64d79`;
};

const unstyledTemplate = (edges: string, direction: string) => {
  return `graph ${direction};
${edges}`;
};

const properNodeId = (node: string) => {
  // Mermaid gets confused by hyphens in node ids
  // For example `get-graph` id will throw a syntax error, because it thinks
  // that it sees the `graph` token.
  return node && node.replace(/-/g, "");
};

const shape = (descriptor?: NodeDescriptor, idPrefix = "") => {
  if (!descriptor) return "";
  const node = descriptor.id;
  const prefix = idPrefix ? `${properNodeId(idPrefix)}_` : "";
  const nodeId = `${prefix}${properNodeId(node)}`;
  const nodeType = descriptor.type;
  const text = `"${nodeType} <br> id='${node}'"`;
  switch (nodeType) {
    case "include":
      return `${nodeId}[[${text}]]:::include`;
    case "slot":
      return `${nodeId}((${text})):::slot`;
    case "passthrough":
      return `${nodeId}((${text})):::passthrough`;
    case "input":
      return `${nodeId}[/${text}/]:::input`;
    case "secrets":
      return `${nodeId}(${text}):::secrets`;
    case "output":
      return `${nodeId}{{${text}}}:::output`;
    default:
      return `${nodeId}[${text}]`;
  }
};

type NodeMap = Map<string, NodeDescriptor>;

const describeEdge = (edge: Edge, nodeMap: NodeMap, idPrefix = "") => {
  const from = edge.from;
  const fromNode = shape(nodeMap.get(from), idPrefix);
  const to = edge.to;
  const toNode = shape(nodeMap.get(to), idPrefix);
  const input = edge.in;
  const output = edge.out;
  const optional = edge.optional;
  const constant = edge.constant;
  if (output === "*") {
    return `${fromNode} -- all --> ${toNode}`;
  }
  if (output && input) {
    if (optional) return `${fromNode} -. "${output}->${input}" .-> ${toNode}`;
    if (constant) return `${fromNode} -- "${output}->${input}" --o ${toNode}`;
    return `${fromNode} -- "${output}->${input}" --> ${toNode}`;
  }
  return `${fromNode} --> ${toNode}`;
};

class MermaidGenerator {
  nodeMap: NodeMap;
  edges: Edge[];
  nodes: NodeDescriptor[];
  idPrefix: string;
  subgraphs: SubGraphs;

  constructor(graph: GraphDescriptor, idPrefix = "") {
    const { edges, nodes } = graph;
    this.nodeMap = new Map(nodes.map((node) => [node.id, node]));
    this.edges = edges;
    this.nodes = nodes;
    this.idPrefix = idPrefix;
    this.subgraphs = graph.graphs || {};
  }

  handleSlotted(fromNode: NodeDescriptor, idPrefix: string) {
    const prefix = idPrefix ? `${properNodeId(idPrefix)}_` : "";
    const type = fromNode.type;
    if (type !== "include") return "";
    const slotted = fromNode.configuration?.slotted;
    if (!slotted) return "";
    const subgraphs = Object.entries(slotted).map(([name, subgraph]) =>
      this.describeSubgraph(
        subgraph,
        name,
        "slotted",
        fromNode,
        `${prefix}${fromNode.id}`
      )
    );
    return subgraphs.join("\n");
  }

  handleLambda(fromNode: NodeDescriptor, idPrefix: string) {
    const prefix = idPrefix ? `${properNodeId(idPrefix)}_` : "";
    const board = fromNode.configuration?.board;
    if (!board) return "";
    type BoardCapability = { kind: "board"; board: GraphDescriptor };
    const capability = board as BoardCapability;
    if (capability.kind !== "board") return "";
    const graph = capability.board;
    return this.describeSubgraph(
      graph,
      fromNode.id,
      "lamdba",
      fromNode,
      `${prefix}${fromNode.id}`
    );
  }

  describeSubgraphs(edge: Edge, idPrefix = ""): string {
    const fromNode = this.nodeMap.get(edge.from);
    if (!fromNode) return "";
    const lamdba = this.handleLambda(fromNode, idPrefix);
    const slotted = this.handleSlotted(fromNode, idPrefix);
    return `${slotted}${lamdba}`;
  }

  describeSubgraph(
    subgraph: GraphDescriptor,
    name: string,
    edgeName?: string,
    fromNode?: NodeDescriptor,
    idPrefix?: string
  ) {
    const subgraphGenerator = new MermaidGenerator(subgraph, idPrefix);
    const edges = subgraphGenerator.describeGraph();
    const prefix = this.idPrefix ? `${properNodeId(this.idPrefix)}_` : "";
    const subgraphEdge =
      edgeName && fromNode
        ? `sg_${properNodeId(
            name
          )}:::slotted -- "${edgeName}->${edgeName}" --o ${prefix}${properNodeId(
            fromNode.id
          )}\n`
        : "";
    return `\nsubgraph sg_${properNodeId(
      name
    )} [${name}]\n${edges}\nend\n${subgraphEdge}`;
  }

  describeGraph() {
    const result = this.edges.map((edge) => {
      const mermEdge = describeEdge(edge, this.nodeMap, this.idPrefix);
      const mermSubgraphs = this.describeSubgraphs(edge, this.idPrefix);
      return `${mermEdge}${mermSubgraphs}`;
    });
    const subgraphs = Object.entries(this.subgraphs).map(([name, subgraph]) =>
      this.describeSubgraph(
        subgraph,
        name,
        undefined,
        undefined,
        `${name}${this.idPrefix}`
      )
    ) as string[];
    return [...result, ...subgraphs].join("\n");
  }
}

export const toMermaid = (
  graph: GraphDescriptor,
  direction = "TD",
  unstyled = false
) => {
  const generator = new MermaidGenerator(graph);
  const edges = generator.describeGraph();
  return unstyled
    ? unstyledTemplate(edges, direction)
    : template(edges, direction);
};
