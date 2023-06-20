/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  NodeDescriptor,
  NodeHandler,
  NodeTypeIdentifier,
} from "./graph.js";

import userInput from "./nodes/user-input.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import consoleOutput from "./nodes/console-output.js";
import localMemory from "./nodes/local-memory.js";

class Node implements NodeDescriptor {
  id: string;

  /**
   *
   * @param configuration "$id" is special. It is the unique identifier of the node.
   */
  constructor(
    private graph: Graph,
    public type: NodeTypeIdentifier,
    public configuration: Record<string, unknown> = {}
  ) {
    this.id = graph.vendNodeId(configuration?.$id);
  }

  /**
   * @todo Add support for multiple routes.
   * @param routing A map of output to input. Currently, only one route is supported.
   * @param destination The node to which the graph edge will be directed.
   * @returns
   */
  to(routing: Record<string, string>, destination: Node): Node {
    const edge = {
      from: {
        node: this.id,
        output: Object.keys(routing)[0],
      },
      to: {
        node: destination.id,
        input: Object.values(routing)[0],
      },
    };

    this.graph.addEdge(edge);
    this.graph.addNode(destination);
    return this;
  }

  asGraph(): GraphDescriptor {
    return this.graph.asDescriptor(this);
  }

  getHandlers() {
    return this.graph.getHandlers();
  }
}

class GraphRunner {
  run(node: Node) {
    // TODO: Implement actual running of the graph.
    console.log(JSON.stringify(node.asGraph(), null, 2));
  }
}

class Graph {
  #nodes: Set<Node> = new Set();
  #edges: Edge[] = [];
  #handlers: Map<NodeHandler, NodeTypeIdentifier> = new Map();
  #nodeCount = 0;
  #nodeHandlerCount = 0;

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
    this.#edges.push(edge);
  }

  addHandler(handler: NodeHandler): NodeTypeIdentifier {
    let id = this.#handlers.get(handler);
    if (id) return id;
    id = this.vendNodeType();
    this.#handlers.set(handler, id);
    return id;
  }

  asDescriptor(entry: Node): GraphDescriptor {
    // TODO: It's weird that getting a graph descriptor also mutates the graph.
    //       Find a way to avoid marking the entry edge in the inner
    //       datastructure.
    const entryEdge = this.#edges.find(
      (edge) => edge.from.node === entry.id
    ) as Edge;
    if (!entryEdge) throw Error("Entry node has no edges");
    entryEdge.entry = true;
    return {
      edges: this.#edges,
      nodes: Array.from(this.#nodes),
    };
  }

  getHandlers() {
    return Array.from(this.#handlers.entries()).reduce((acc, [handler, id]) => {
      acc[id] = handler;
      return acc;
    }, {} as Record<NodeTypeIdentifier, NodeHandler>);
  }
}

const makeNode = () => {
  const graph = new Graph();
  return (handler: NodeHandler, configuration: Record<string, unknown>) => {
    return new Node(graph, graph.addHandler(handler), configuration);
  };
};

const node = makeNode();

const print = node(consoleOutput, { $id: "console-output-1" });
const rememberAlbert = node(localMemory, { $id: "remember-albert" });
const rememberFriedrich = node(localMemory, { $id: "remember-friedrich" });

const albert = node(promptTemplate, {
  $id: "albert",
  template:
    'Add a single argument to a debate between a scientist named Albert and a philosopher named Friedrich. You are Albert, and you are warm, funny, inquisitve, and passionate about uncovering new insights with Friedrich. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating."\n\n== Debate History\n{{context}}\n\n==Additional Single Argument\n\nAlbert:',
}).to(
  { prompt: "text" },
  node(textCompletion, {
    $id: "albert-completion",
    "stop-sequences": ["\nFriedrich", "\n**Friedrich"],
  })
    .to(
      { completion: "context" },
      node(promptTemplate, {
        $id: "albert-voice",
        template:
          "Restate the paragraph below in the voice of a brillant 20th century scientist. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
      }).to(
        { prompt: "text" },
        node(textCompletion, {
          $id: "albert-voice-completion",
        }).to({ completion: "text" }, print)
      )
    )
    .to({ completion: "Albert" }, rememberAlbert)
);

const friedrich = node(promptTemplate, {
  $id: "friedrich",
  template:
    "Add a single argument to a debate between a philosopher named Friedrich and a scientist named Albert. You are Friedrich, and you are disagreeable, brooding, skeptical, sarcastic, yet passionate about uncovering new insights with Albert. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating.\n\n== Conversation Transcript\n{{context}}\n\n==Additional Single Argument\nFriedrich:",
}).to(
  { prompt: "text" },
  node(textCompletion, {
    $id: "friedrich-completion",
    "stop-sequences": ["\nAlbert", "\n**Albert"],
  })
    .to(
      { completion: "context" },
      node(promptTemplate, {
        $id: "friedrich-voice",
        template:
          "Restate the paragraph below in the voice of a 19th century philosopher. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
      }).to(
        { prompt: "text" },
        node(textCompletion, {
          $id: "friedrich-voice-completion",
        }).to({ completion: "text" }, print)
      )
    )
    .to({ completion: "Friedrich" }, rememberFriedrich)
);

rememberFriedrich.to({ context: "context" }, albert);
rememberAlbert.to({ context: "context" }, friedrich);

const debateTopic = node(userInput, {
  $id: "debate-topic",
  message: "What is the topic of the debate?",
}).to(
  { text: "topic" },
  node(localMemory, {
    $id: "remember-topic",
  }).to({ context: "context" }, albert)
);

const graph = new GraphRunner();
graph.run(debateTopic);
