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

/**
 * Describes a node type.
 * @todo Currently, `inputs` and `outputs` are fixed. How do we handle flexible number of inputs/outputs?
 */
export interface NodeTypeDescriptor {
  /**
   * A list of Node type's declared outputs. Outputs are where graph edges
   * originate from.
   */
  inputs: InputIdentifier[];
  /**
   * A list of Node type's declared inputs. Inputs are where graph edges arrive at.
   */
  outputs: OutputIdentifier[];
}

export interface FromIdentifier {
  node: NodeIdentifier;
  output: OutputIdentifier;
}

export interface ToIdentifier {
  node: NodeIdentifier;
  input: InputIdentifier;
}

export interface Edge {
  /**
   * The designated first edge in the graph.
   */
  entry?: boolean;
  from: FromIdentifier;
  to: ToIdentifier;
}

export interface GraphDescriptor {
  edges: Edge[];
  nodes: NodeDescriptor[];
}

export type InputValues = Record<InputIdentifier, unknown>;

export type OutputValues = Partial<Record<OutputIdentifier, unknown>>;

export type NodeHandlerResult = OutputValues;

export type NodeConfiguration = Record<string, string>;

export type NodeHandler = (inputs?: InputValues) => Promise<NodeHandlerResult>;

export type NodeHandlers = Record<NodeTypeIdentifier, NodeHandler>;

const wire = (heads: Edge[], outputs: OutputValues): InputValues => {
  const result: InputValues = {};
  heads.forEach((head) => {
    const output = outputs[head.from.output];
    if (output) result[head.to.input] = outputs[head.from.output];
  });
  return result;
};

const handle = async (
  nodeHandlers: NodeHandlers,
  descriptor: NodeDescriptor,
  inputs?: InputValues | null
) => {
  const handler = nodeHandlers[descriptor.type];
  if (!handler)
    throw new Error(`No handler for node type "${descriptor.type}"`);

  const aggregate = { ...descriptor.configuration, ...inputs };
  const result = await handler(aggregate);
  return result;
};

/**
 * Additional concept: whether or not an output was consumed by the intended
 * input.
 * State stores all outputs that have not yet been consumed, organized as
 * a map of maps:
 */
export type State = Map<NodeIdentifier, Map<NodeIdentifier, OutputValues>>;

class StateManager {
  #state = new Map();

  update(node: NodeIdentifier, opportunities: Edge[], outputs: OutputValues) {
    // 1. Clear entries for the current node.
    this.#state.delete(node);
    // 2. Add entries for each opportunity.
    opportunities.forEach((opportunity) => {
      const toNode = opportunity.to.node;
      let fromNodeMap = this.#state.get(toNode);
      if (!fromNodeMap) {
        fromNodeMap = new Map();
        this.#state.set(toNode, fromNodeMap);
      }
      fromNodeMap.set(opportunity.from.node, outputs);
    });
    // console.log("== State after update", this.#state);
  }

  getAvailableOutputs(node: NodeIdentifier) {
    const edges: Map<NodeIdentifier, OutputValues> = this.#state.get(node);
    const result: OutputValues = {};
    if (!edges) return result;
    for (const outputs of edges.values()) {
      Object.assign(result, outputs);
    }
    // console.log("== Available outputs:", result);
    return result;
  }
}

/**
 * A slightly less dumb, but incredibly unkempt edge follower.
 * @todo implement nicer traversal, something like a topology sort with feedback problem resolution.
 * @param graph graph to follow
 */
export const follow = async (
  graph: GraphDescriptor,
  nodeHandlers: NodeHandlers,
  log: (s: string) => void
) => {
  const state = new StateManager();

  /**
   * Tails: a map of all outgoing edges, keyed by node id.
   */
  const tails = graph.edges.reduce((acc, edge) => {
    const from = edge.from.node;
    acc.has(from) ? acc.get(from)?.push(edge) : acc.set(from, [edge]);
    return acc;
  }, new Map());

  /**
   * Heads: a map of all incoming edges, keyed by node id.
   */
  const heads = graph.edges.reduce((acc, edge) => {
    const to = edge.to.node;
    acc.has(to) ? acc.get(to)?.push(edge) : acc.set(to, [edge]);
    return acc;
  }, new Map());

  /**
   * Nodes: a map of all nodes, keyed by node id.
   */
  const nodes = graph.nodes.reduce((acc, node) => {
    acc[node.id] = node;
    return acc;
  }, {} as Record<NodeIdentifier, NodeDescriptor>);

  log(`Let the graph traversal begin!`);

  const entry = graph.edges.find((edge) => edge.entry);
  if (!entry) throw new Error("No entry edge found in graph.");
  log(`Starting at node "${entry.from.node}"`);

  const entryNode = nodes[entry.from.node];
  const handlerResult = await handle(nodeHandlers, entryNode, {});
  // TODO: Make it not a special case.
  const exit = handlerResult.exit as boolean;
  if (exit) return;

  const opportunities = [entry];
  state.update(entry.from.node, opportunities, handlerResult);

  while (opportunities.length > 0) {
    const opportunity = opportunities.shift() as Edge;

    const toNode: NodeIdentifier = opportunity.to.node;
    const current = nodes[toNode];

    if (!current) throw new Error(`No node found for id "${toNode}"`);

    log(`Visiting: "${current.id}", type: "${current.type}"`);

    const outputs = state.getAvailableOutputs(toNode);
    const inputs = wire(heads.get(toNode), outputs);

    Object.entries(inputs).forEach(([key, value]) => {
      log(`- Input "${key}": ${value}`);
    });

    const requiredInputs: string[] = heads
      .get(toNode)
      .filter((edge: Edge) => !!edge.to.input)
      .map((edge: Edge) => edge.to.input);
    // console.log("== Required inputs:", requiredInputs);
    const inputsWithConfiguration = new Set();
    Object.keys(inputs).forEach((key) => inputsWithConfiguration.add(key));
    if (current.configuration) {
      Object.keys(current.configuration).forEach((key) =>
        inputsWithConfiguration.add(key)
      );
    }
    const missingInputs = requiredInputs.filter(
      (input) => !inputsWithConfiguration.has(input)
    );
    if (missingInputs.length > 0) {
      log(
        `Missing inputs: ${missingInputs.join(", ")}, Skipping node "${toNode}"`
      );
      continue;
    }

    const handlerResult = await handle(nodeHandlers, current, inputs);
    // TODO: Make it not a special case.
    const exit = handlerResult.exit as boolean;
    if (exit) return;

    Object.entries(handlerResult).forEach(([key, value]) => {
      log(`- Output "${key}": ${value}`);
    });

    const newOpportunities = tails.get(toNode);
    opportunities.push(...newOpportunities);
    opportunities.forEach((opportunity) => {
      log(`- Opportunity: "${opportunity.to.node}"`);
    });

    state.update(toNode, newOpportunities, handlerResult);
  }
  log("Graph traversal complete.");
};
