/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unique identifier of a node in a graph.
 * @todo Should this be globally unique? Likely a URI.
 */
export type NodeIdentifier = string;

/**
 * Unique identifier of a node's output.
 */
export type OutputIdentifier = string;

/**
 * Unique identifier of a node's input.
 */
export type InputIdentifier = string;

export type NodeTypeIdentifier = string;

/**
 * General node representation.
 */
export interface NodeDescriptor {
  /**
   * Unique id of the node in graph.
   */
  id: NodeIdentifier;
  /**
   * Type of the node. What does this node do?
   */
  type: NodeTypeIdentifier;
  /**
   * Configuration of the node.
   */
  configuration: NodeConfiguration;
}

export interface Edge {
  /**
   * The designated first edge in the graph.
   */
  from: NodeIdentifier;
  to: NodeIdentifier;
  in: InputIdentifier;
  out: OutputIdentifier;
  optional?: boolean;
}

export interface GraphDescriptor {
  edges: Edge[];
  nodes: NodeDescriptor[];
}

export type InputValues = Record<InputIdentifier, unknown>;

export type OutputValues = Partial<Record<OutputIdentifier, unknown>>;

export type NodeHandlerResult = OutputValues;

export type NodeConfiguration = Record<string, unknown>;

export type NodeHandler = (
  inputs?: InputValues,
  context?: GraphContext
) => Promise<NodeHandlerResult>;

export type NodeHandlers = Record<NodeTypeIdentifier, NodeHandler>;

export interface GraphContext {
  handlers: NodeHandlers;
  follow: (graph: GraphDescriptor, handlers: NodeHandlers) => Promise<void>;
}

export class Node implements NodeDescriptor {
  #graph: Graph;
  id: string;
  configuration: NodeConfiguration;

  /**
   *
   * @param configuration "$id" is special. It is the unique identifier of the node.
   */
  constructor(
    graph: Graph,
    public type: NodeTypeIdentifier,
    configuration: Record<string, unknown> = {}
  ) {
    this.#graph = graph;
    const { $id, ...rest } = configuration;
    this.id = graph.vendNodeId($id);
    this.configuration = rest;
    this.#graph.addNode(this);
  }

  /**
   * @todo Add support for multiple routes.
   * @param routing A map of output to input. Currently, only one route is supported.
   * @param destination The node to which the graph edge will be directed.
   * @returns
   */
  to(
    routing: Record<"$entry" | string, string | boolean>,
    destination: Node | NodeHandler
  ): Node {
    const { $entry, ...rest } = routing;
    const entry = $entry as boolean;
    const node =
      destination instanceof Node
        ? destination
        : new Node(this.#graph, this.#graph.addHandler(destination));
    const edge = {
      entry,
      from: this.id,
      out: Object.keys(rest)[0] as string,
      to: node.id,
      in: Object.values(rest)[0] as string,
    };

    this.#graph.addEdge(edge);
    return this;
  }
}

export class Graph implements GraphDescriptor {
  edges: Edge[] = [];

  #nodes: Set<Node> = new Set();
  #handlers: Map<NodeHandler, NodeTypeIdentifier> = new Map();
  #nodeCount = 0;
  #nodeHandlerCount = 0;

  constructor() {
    this.newNode = this.newNode.bind(this);
  }

  newNode(handler: NodeHandler, configuration?: Record<string, unknown>) {
    return new Node(this, this.addHandler(handler), configuration);
  }

  vendNodeId(id?: unknown) {
    return (id as string) ?? `node-${this.#nodeCount++}`;
  }

  vendNodeType() {
    return `node-type-${this.#nodeHandlerCount++}`;
  }

  addNode(node: Node) {
    this.#nodes.add(node);
  }

  addEdge(edge: Edge) {
    this.edges.push(edge);
  }

  addHandler(handler: NodeHandler): NodeTypeIdentifier {
    let id = this.#handlers.get(handler);
    if (id) return id;
    id = this.vendNodeType();
    this.#handlers.set(handler, id);
    return id;
  }

  get nodes() {
    return Array.from(this.#nodes);
  }

  getHandlers(): NodeHandlers {
    return Array.from(this.#handlers.entries()).reduce((acc, [handler, id]) => {
      acc[id] = handler;
      return acc;
    }, {} as NodeHandlers);
  }

  toJSON() {
    return { edges: this.edges, nodes: this.nodes };
  }
}
