/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  follow,
  type Edge,
  type GraphDescriptor,
  type NodeConfiguration,
  type NodeDescriptor,
  type NodeHandler,
  type NodeHandlers,
  type NodeTypeIdentifier,
} from "./graph.js";

import userInput from "./nodes/user-input.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import consoleOutput from "./nodes/console-output.js";
import localMemory from "./nodes/local-memory.js";
import { Logger } from "./logger.js";
import { log } from "console";

class Node implements NodeDescriptor {
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
    destination: Node
  ): Node {
    const { $entry, ...rest } = routing;
    const entry = $entry as boolean;
    const edge = {
      entry,
      from: {
        node: this.id,
        output: Object.keys(rest)[0] as string,
      },
      to: {
        node: destination.id,
        input: Object.values(rest)[0] as string,
      },
    };

    this.#graph.addEdge(edge);
    return this;
  }
}

const root = new URL("../../", import.meta.url);
const logger = new Logger(`${root.pathname}/experiment.log`);

class GraphRunner {
  async run(graph: Graph) {
    try {
      await follow(graph, graph.getHandlers(), (s: string) => {
        logger.log(s);
      });
    } catch (e) {
      logger.log((e as Error).message);
    }
    logger.save();
  }
}

class Graph implements GraphDescriptor {
  edges: Edge[] = [];

  #nodes: Set<Node> = new Set();
  #handlers: Map<NodeHandler, NodeTypeIdentifier> = new Map();
  #nodeCount = 0;
  #nodeHandlerCount = 0;

  constructor() {
    this.newNode = this.newNode.bind(this);
  }

  newNode(handler: NodeHandler, configuration: Record<string, unknown>) {
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

const graph = new Graph();

// Nifty hack to save from typing characters.
const node = graph.newNode;

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

node(userInput, {
  $id: "debate-topic",
  message: "What is the topic of the debate?",
}).to(
  { $entry: true, text: "topic" },
  node(localMemory, {
    $id: "remember-topic",
  }).to({ context: "context" }, albert)
);

const runner = new GraphRunner();
await runner.run(graph);
