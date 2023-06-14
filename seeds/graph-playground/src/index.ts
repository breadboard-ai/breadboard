/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type NodeIdentifier = string;

type OutputIdentifier = string;

type InputIdentifier = string;

/**
 * General node representation.
 */
interface NodeDescriptor {
  /**
   * Unique id of the node in graph.
   * @todo Should this be globally unique? Unique within a graph?
   */
  id: NodeIdentifier;
  /**
   * A list of Node's declared outputs. Outputs are where graph edges
   * originate from.
   */
  inputs: InputIdentifier[];
  /**
   * A list of Node's declared inputs. Inputs are where graph edges arrive at.
   */
  outputs: OutputIdentifier[];
}

interface FromIdentifier {
  node: NodeIdentifier;
  output: OutputIdentifier;
}

interface ToIdentifier {
  node: NodeIdentifier;
  input: InputIdentifier;
}

interface Edge {
  /**
   * The designated first edge in the graph.
   */
  entry?: boolean;
  from: FromIdentifier;
  to: ToIdentifier;
}

interface GraphDescriptor {
  edges: Edge[];
  nodes: NodeDescriptor[];
}

const graph: GraphDescriptor = {
  edges: [
    {
      entry: true,
      from: { node: "user-input", output: "output" },
      to: { node: "text-completion", input: "text" },
    },
    {
      from: { node: "text-completion", output: "completion" },
      to: { node: "console-output", input: "text" },
    },
  ],
  nodes: [
    { id: "user-input", outputs: ["text"], inputs: [] },
    { id: "text-completion", inputs: ["text"], outputs: ["completion"] },
    { id: "console-output", inputs: ["text"], outputs: [] },
  ],
};

/**
 * The dumbest possible edge follower.
 * @param graph graph to follow
 */
const follow = (graph: GraphDescriptor) => {
  let edge = graph.edges.find((edge) => edge.entry);

  while (edge) {
    console.log(`from "${edge.from.node}: ${edge.from.output}"`);
    console.log(`to "${edge.to.node}: ${edge.to.input}"`);
    edge = graph.edges.find((edge) => edge.from.node == edge.to.node);
  }
};

follow(graph);
