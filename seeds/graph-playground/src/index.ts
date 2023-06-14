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
  nodes: Record<NodeIdentifier, NodeDescriptor>;
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
  nodes: {
    "user-input": { id: "user-input", outputs: ["text"], inputs: [] },
    "text-completion": {
      id: "text-completion",
      inputs: ["text"],
      outputs: ["completion"],
    },
    "console-output": { id: "console-output", inputs: ["text"], outputs: [] },
  },
};

const invokeNode = (
  node: NodeDescriptor,
  input: InputIdentifier | null
): OutputIdentifier[] => {
  console.log(
    `invoke node "${node.id}" with ${input ? `input "${input}"` : "no input"}`
  );
  if (!node.outputs.length) {
    console.log("node produces no further outputs");
  } else {
    console.log(
      `node produces outputs:${node.outputs.map((output) => `\n- ${output}`)}`
    );
  }
  return node.outputs;
};

const invoke = (edge: Edge) => {
  console.log(
    `[invoke node: "${edge.from.node}", get "${edge.from.output}" output, feed to input "${edge.to.input}" of node "${edge.to.node}"]`
  );
};

/**
 * The dumbest possible edge follower.
 * @param graph graph to follow
 */
const follow = (graph: GraphDescriptor) => {
  let edge = graph.edges.find((edge) => edge.entry);
  let next: NodeIdentifier | null = null;
  let input: InputIdentifier | null = null;
  let outputs: OutputIdentifier[] | null = null;

  while (edge) {
    const current = graph.nodes[edge.from.node];
    outputs = invokeNode(current, input);

    input = edge.to.input;
    invoke(edge);
    next = edge.to.node;
    edge = graph.edges.find((edge) => edge.from.node == next);
  }
  if (next) {
    const last = graph.nodes[next];
    invokeNode(last, input);
  }
};

follow(graph);
