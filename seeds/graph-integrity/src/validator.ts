/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file bridges between Breadboard and the rest of the integrity code.
 *
 * It exports a BreadboardValidator, it translates a GraphDescriptor into the
 * local graph notation, implements semantics for include/slot with input/output
 * and applies the trusted labels.
 */

import {
  GraphDescriptor,
  Edge,
  NodeDescriptor,
} from "@google-labs/graph-runner";
import {
  type BreadboardValidator,
  type BreadboardValidatorMetadata,
} from "@google-labs/breadboard";

import { Graph, Node, IncomingEdge, OutgoingEdge, NodeRoles } from "./types.js";
import { computeLabelsForGraph } from "./compute-labels.js";
import { SafetyLabel } from "./label.js";
import { trustedLabels } from "./trusted-labels.js";

export interface GraphIntegrityValidatorMetadata
  extends BreadboardValidatorMetadata {
  label: SafetyLabel;
}

interface IncomingEdgeFromBreadboard extends IncomingEdge {
  edge: Edge;
  from: NodeFromBreadboard;
}

interface OutgoingEdgeFromBreadboard extends OutgoingEdge {
  edge: Edge;
  to: NodeFromBreadboard;
}

interface NodeFromBreadboard extends Node {
  node: NodeDescriptor;
  insertionNumber: number;
  incoming: IncomingEdgeFromBreadboard[];
  outgoing: OutgoingEdgeFromBreadboard[];
}

interface GraphFromBreadboard extends Graph {
  nodes: NodeFromBreadboard[];
}

const typeToRole = new Map<string, NodeRoles>([
  ["passthrough", NodeRoles.passthrough],
  ["include", NodeRoles.placeHolder],
  ["slot", NodeRoles.placeHolder],
]);

type IdMap = Map<string, NodeFromBreadboard>;
let insertionCount = 0;

/**
 * @class Breadboard GraphIntegrityValidator
 *
 * @implements {BreadboardValidator} and validates the integrity of a graph in
 * terms of safety.
 *
 * Use one instance per id namespace. Call @method {addGraph} to add nodes to
 * the validator. And call @method {getSubgraphValidator} to get a new validator
 * for new namespaces, such as include and slot nodes
 *
 * Acts as bridge between Breadboard and the generic graph validation code.
 */
export class GraphIntegrityValidator implements BreadboardValidator {
  protected wholeGraph: GraphFromBreadboard;
  protected idMap: IdMap = new Map();
  protected parentNode: NodeFromBreadboard | undefined;

  constructor(
    wholeGraph?: GraphFromBreadboard,
    parentNode?: NodeFromBreadboard
  ) {
    this.wholeGraph = wholeGraph ?? ({ nodes: [] } as GraphFromBreadboard);
    this.parentNode = parentNode;
  }

  /**
   * Add nodes to the validator and validate the full graph.
   *
   * @param graph Graph to validate.
   * @throws {Error} if the graph is not safe.
   */
  addGraph(newGraph: GraphDescriptor) {
    insertGraph(this.wholeGraph, newGraph, this.idMap, this.parentNode);
    computeLabelsForGraph(this.wholeGraph);
    insertionCount++;
  }

  /**
   * Get the safety label of a node.
   *
   * @param nodeId The id of the node to get the label for.
   * @returns The safety label of the node, or undefined if it wasn't computed.
   *          Note that the safety label's value can be undefined, meaning that
   *          there were no constraints on it.
   */
  getValidatorMetadata(node: NodeDescriptor): GraphIntegrityValidatorMetadata {
    const label = this.getNodeById(node)?.label;
    if (!label) throw Error(`Safety label for node ${node.id} not computed.`);
    return {
      description: label.toString() ?? "Unknown label",
      label,
    };
  }

  /**
   * Generate a validator for a subgraph, replacing a given node. Call
   * .addGraph() on the returned validator to add and validate the subgraph.
   *
   * @param node The node to replace.
   * @returns A validator for the subgraph.
   */
  getSubgraphValidator(node: NodeDescriptor): BreadboardValidator {
    const parentNode = this.getNodeById(node);
    if (!parentNode) throw Error(`Node ${node.id} not found.`);

    return new GraphIntegrityValidator(this.wholeGraph, parentNode);
  }

  toMermaid(): string {
    return toMermaid(this.wholeGraph);
  }

  protected getNodeById(node: NodeDescriptor): NodeFromBreadboard | undefined {
    return this.idMap.get(node.id);
  }
}

/**
 * Insert a new graph into this graph.
 *
 * @param graph Graph that will receive new graph
 * @param newGraph Graph to be inserted
 * @param idMap Id map to be updated, namespaced to the inserted graph
 * @param parentNode Optional parent node to which this graph will be wired
 */
function insertGraph(
  graph: Graph,
  newGraph: GraphDescriptor,
  idMap: IdMap,
  parentNode?: NodeFromBreadboard
): void {
  const newNodes = newGraph.nodes.map((node) => {
    const internalNode = {
      node,
      insertionNumber: insertionCount,
      incoming: [],
      outgoing: [],
      label: new SafetyLabel(),
      constraint: trustedLabels.get(node.type),
      role: typeToRole.get(node.type),
    } as NodeFromBreadboard;
    idMap.set(node.id, internalNode);
    return internalNode;
  });

  graph.nodes.push(...newNodes);

  newGraph.edges.forEach((edge) => {
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from) throw new Error(`Invalid graph: Can't find node ${edge.from}`);
    if (!to) throw new Error(`Invalid graph: Can't find node ${edge.from}`);

    const incoming = { edge, from } as IncomingEdgeFromBreadboard;
    const outgoing = { edge, to } as OutgoingEdgeFromBreadboard;

    from.outgoing.push(outgoing);
    to.incoming.push(incoming);
  });

  // If this is an included graph, we need to connect the input and output
  // nodes. The parent node acts as placeholder. We need to keep the original
  // wires to the place holder node, so that we can include multiple graphs at
  // the same point.
  if (parentNode) {
    const inputNodes = newNodes.filter((node) => node.node.type === "input");
    const outputNodes = newNodes.filter((node) => node.node.type === "output");

    parentNode.incoming.forEach((incoming) => {
      const newEdges: OutgoingEdgeFromBreadboard[] = [];

      incoming.from.outgoing.forEach((outgoing) => {
        if (outgoing.to === parentNode)
          inputNodes.forEach((input) =>
            newEdges.push({ ...outgoing, to: input })
          );
      });
      incoming.from.outgoing.push(...newEdges);

      inputNodes.forEach((input) => input.incoming.push(incoming));
    });

    parentNode.outgoing.forEach((outgoing) => {
      const newEdges: IncomingEdgeFromBreadboard[] = [];

      outgoing.to.incoming.forEach((incoming) => {
        if (incoming.from === parentNode)
          outputNodes.forEach((output) =>
            newEdges.push({ ...incoming, from: output })
          );
      });
      outgoing.to.incoming.push(...newEdges);

      outputNodes.forEach((output) => output.outgoing.push(outgoing));
    });

    inputNodes.forEach((input) => (input.role = NodeRoles.passthrough));
    outputNodes.forEach((output) => (output.role = NodeRoles.passthrough));
  }
}

function getMermaidId(node: NodeFromBreadboard) {
  return `${node.node.id.replace(/-/g, "_")}_${node.insertionNumber}`;
}

function toMermaid(graph: GraphFromBreadboard) {
  const edges = [];
  const nodes = [];

  for (const node of graph.nodes) {
    const fromId = getMermaidId(node);
    for (const edge of node.outgoing) {
      const toId = getMermaidId(edge.to);
      edges.push(`${fromId} --> ${toId}`);
    }

    nodes.push(`${fromId}[${fromId} <br> ${node.label.toString()}]`);
  }

  return `
    %%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
    graph TD;
    ${edges.join("\n")}
    ${nodes.join("\n")}
    classDef default stroke:#ffab40,fill:#fff2ccff,color:#000;`;
}
