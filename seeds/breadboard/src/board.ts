/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  NodeDescriptor,
  NodeHandlers,
  InputValues,
  GraphDescriptor,
  OutputValues,
  NodeHandler,
} from "@google-labs/graph-runner";

import {
  type Breadboard,
  type BreadboardSlotSpec,
  type BreadbordRunResult,
  type Kit,
  type KitConstructor,
  type OptionalIdConfiguration,
  type BreadboardValidator,
  ProbeDetails,
} from "./types.js";

import { TraversalMachine, toMermaid } from "@google-labs/graph-runner";
import { Node } from "./node.js";
import { Core } from "./core.js";
import { InputStageResult, OutputStageResult } from "./run.js";
import { KitLoader } from "./kit.js";
import { IdVendor } from "./id.js";

class ProbeEvent extends CustomEvent<ProbeDetails> {
  constructor(type: string, detail: ProbeDetails) {
    super(type, { detail });
  }
}

/**
 * @todo Make this just take a $ref and figure out when it's a path or a URL.
 * @param path
 * @param ref
 * @returns
 */
export const loadGraph = async (path?: string, ref?: string) => {
  if (path && typeof process !== "undefined") throw new Error("Unable to use `path` when not running in node");
  if (path) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(path, "utf-8"));
  }
  if (!ref) throw new Error("To include, we need a path or a $ref");
  const response = await fetch(ref);
  return await response.json();
};

const nodeTypeVendor = new IdVendor();

class LocalKit implements Kit {
  /**
   * The "." signifies local.
   */
  url = ".";

  #handlers: NodeHandlers = {};

  addHandler(type: string, handler: NodeHandler) {
    this.#handlers[type] = handler;
  }

  get handlers() {
    return this.#handlers;
  }
}

/**
 * This is the heart of the Breadboard library.
 * Just like for hardware makers, the `Board` is the place where wiring of
 * a prototype happens.
 *
 * To start making, create a new breadboard:
 *
 * ```js
 * const board = new Board();
 * ```
 *
 * For more information on how to use Breadboard, start with [Chapter 1: Hello, world?](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the tutorial.
 */
export class Board implements Breadboard {
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  kits: Kit[] = [];
  #localKit?: LocalKit;
  #slots: BreadboardSlotSpec = {};
  #validators: BreadboardValidator[] = [];

  /**
   * Runs the board. This method is an async generator that
   * yields the results of each stage of the run.
   *
   * Conceptually, when we ask the board to run, it will occasionally pause
   * and give us a chance to interact with it.
   *
   * It's typically used like this:
   *
   * ```js
   * for await (const stop of board.run()) {
   * // do something with `stop`
   * }
   * ```
   *
   * The `stop` iterator result will have the following properties:
   *
   * - `seeksInputs`: boolean - returns `true` if the board is waiting for
   *  input values. Returns `false` if the board is providing outputs.
   * - `inputs`: InputValues - the input values the board is waiting for. Set this property to provide input values. This property is only available when `seeksInputs` is `true`.
   * - `inputArguments`: InputValues - any arguments that were passed to the `input` node that triggered this stage. Usually contains `message` property, which is a friendly message to the user about what input is expected. This property is only available when `seeksInputs` is `true`.
   * - `outputs`: OutputValues - the output values the board is providing. This property is only available when `seeksInputs` is `false`.
   *
   * See [Chapter 8: Continuous runs](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial for an example of how to use this method.
   *
   * @param probe - an optional probe. If provided, the board will dispatch
   * events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information.
   */
  async *run(probe?: EventTarget): AsyncGenerator<BreadbordRunResult> {
    const core = new Core(this, this.#slots, this.#validators, probe);
    const kits = [core, ...this.kits];
    const handlers = kits.reduce((handlers, kit) => {
      return { ...handlers, ...kit.handlers };
    }, {} as NodeHandlers);

    this.#validators.forEach((validator) => validator.addGraph(this));

    const machine = new TraversalMachine(this);

    for await (const result of machine) {
      const { inputs, descriptor, missingInputs } = result;

      if (result.skip) {
        probe?.dispatchEvent(
          new ProbeEvent("skip", { descriptor, inputs, missingInputs })
        );
        continue;
      }

      if (descriptor.type === "input") {
        const inputStage = new InputStageResult(inputs);
        yield inputStage;
        result.outputs = inputStage.inputs;
        probe?.dispatchEvent(
          new ProbeEvent("input", {
            descriptor,
            inputs,
            outputs: result.outputs,
          })
        );
        continue;
      }

      if (descriptor.type === "output") {
        probe?.dispatchEvent(new ProbeEvent("output", { descriptor, inputs }));
        yield new OutputStageResult(inputs);
        continue;
      }

      // The include and slot handlers require a reference to themselves to
      // create subgraph validators at the right location in the graph.
      if (["include", "slot"].includes(descriptor.type))
        inputs["parent"] = descriptor;

      const handler = handlers[descriptor.type];
      if (!handler)
        throw new Error(`No handler for node type "${descriptor.type}"`);

      const outputs = (await handler(inputs)) || {};
      probe?.dispatchEvent(
        new ProbeEvent("node", {
          descriptor,
          inputs,
          outputs,
          validatorMetadata: this.#validators.map((validator) =>
            validator.getValidatorMetadata(descriptor)
          ),
        })
      );

      result.outputs = outputs;
    }
  }

  /**
   * A simplified version of `run` that runs the board until the board provides
   * an output, and returns that output.
   *
   * This is useful for running boards that don't have multiple outputs
   * or the the outputs are only expected to be visited once.
   *
   * @param inputs - the input values to provide to the board.
   * @param probe - an optional probe. If provided, the board will dispatch
   * events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information.
   * @returns - outputs provided by the board.
   */
  async runOnce(
    inputs: InputValues,
    probe?: EventTarget
  ): Promise<OutputValues> {
    let outputs: OutputValues = {};
    for await (const result of this.run(probe)) {
      if (result.seeksInputs) {
        result.inputs = inputs;
      } else {
        outputs = result.outputs;
        // Exit once we receive the first output.
        break;
      }
    }
    return outputs;
  }

  /**
   * Add validator to the board.
   * Will call .addGraph() on the validator before executing a graph.
   *
   * @param validator - a validator to add to the board.
   */
  addValidator(validator: BreadboardValidator) {
    this.#validators.push(validator);
  }

  /**
   * Core nodes. Breadboard won't function without these.
   * These are always included.
   */

  /**
   * Places the `passthrough` node on the board.
   *
   * A `passthrough` node is a node that simply passes its inputs to
   * its outputs. Every computing machine needs a no-op node,
   * and Breadboard library is no exception.
   *
   * See [`passthrough` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#passthrough) for more information.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  passthrough(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "passthrough", { ...rest }, $id);
  }

  /**
   * Places an `input` node on the board.
   *
   * An `input` node is a node that asks for inputs from the user.
   *
   * See [`input` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#input) for more information.
   *
   * @param message - a friendly message to the user about what input is expected. For example, "What is the question you'd like to have answered?".
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  input(message?: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "input", { message, ...rest }, $id);
  }

  /**
   * Places an `output` node on the board.
   *
   * An `output` node is a node that provides outputs to the user.
   *
   * See [`output` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#output) for more information.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  output(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "output", { ...rest }, $id);
  }

  /**
   * Places an `include` node on the board.
   *
   * Use this node to include other boards into the current board.
   *
   * The `include` node acts as a sort of instant board-to-node converter:
   * just give it the URL of a serialized board, and it will pretend as if
   * that whole board is just one node.
   *
   * See [`include` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#include) for more information.
   *
   * @param $ref - the URL of the board to include.
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  include($ref: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "include", { $ref, ...rest }, $id);
  }

  /**
   * Places a `reflect` node on the board.
   *
   * This node is used to reflect the board itself. It provides a JSON
   * representation of the board as a `graph` output property. This can be
   * used for studying the board's structure from inside the board.
   *
   * See [`reflect` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#reflect) for more information.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  reflect(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "reflect", { ...rest }, $id);
  }

  /**
   * Places a `slot` node on the board.
   *
   * This node is used to provide a slot for another board to be placed into.
   *
   * This type of node is useful for situations where we wish to leave
   * a place in the board where anyone could insert other boards.
   *
   * Programmers call it "dependency injection".
   *
   * See [`slot` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#slot) for more information.
   *
   * @param slot - the name of the slot.
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  slot(slot: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "slot", { slot, ...rest }, $id);
  }

  /**
   * This method is a work in progress. Once finished, it will allow
   * placing a `node` node on the board.
   *
   * This node can be used to add your own JS functions to the board.
   * If you can't find the node in a kit that suits your needs, this might
   * be a good fit.
   *
   * Downside: it makes your board non-portable. The serialized JSON of the
   * board will **not** contain the code of the function, which means that
   * your friends and colleagues won't be able to re-use it.
   *
   * @param handler -- the function that will be called when the node is visited. It must take an object with input values and return an object with output values. The function can be sync or async. For example:
   *
   * ```js
   * const board = new Board();
   * board
   *   .input()
   *   .wire(
   *     "say->",
   *     board
   *       .node(({ say }) => ({ say: `I said: ${say}` }))
   *       .wire("say->", board.output())
   *   );
   * ```
   *
   * @param config -- optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  node(handler: NodeHandler, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    const type = nodeTypeVendor.vendId(this, "node");
    if (!this.#localKit) {
      this.#localKit = new LocalKit();
      this.kits.push(this.#localKit);
    }
    this.#localKit.addHandler(type, handler);
    return new Node(this, type, { ...rest }, $id);
  }

  addEdge(edge: Edge) {
    this.edges.push(edge);
  }

  addNode(node: NodeDescriptor): void {
    this.nodes.push(node);
  }

  /**
   * Adds a new kit to the board.
   *
   * Kits are collections of nodes that are bundled together for a specific
   * purpose. For example, the [LLM Starter Kit](https://github.com/google/labs-prototypes/tree/main/seeds/llm-starter) provides a few nodes that
   * are useful for making generative AI applications.
   *
   * Typically, kits are distributed as NPM packages. To add a kit to the board,
   * simply install it using `npm` or `yarn`, and then add it to the board:
   *
   * ```js
   * import { Board } from "@google-labs/breadboard";
   * import { Starter } from "@google-labs/llm-starter";
   *
   * const board = new Board();
   * const kit = board.addKit(Starter);
   * ```
   *
   * @param ctr - the kit constructor.
   * @returns - the kit object, which is associated with
   * the board and can be used to place nodes on that board.
   */
  addKit<T extends Kit>(ctr: KitConstructor<T>): T {
    const kit = new ctr((...args) => {
      return new Node(this, ...args);
    });
    this.kits.push(kit);
    return kit;
  }

  /**
   * Returns a [Mermaid](https://mermaid-js.github.io/mermaid/#/) representation
   * of the board.
   *
   * This is useful for visualizing the board.
   *
   * @returns - a string containing the Mermaid representation of the board.
   */
  mermaid(): string {
    return toMermaid(this);
  }

  /**
   * Creates a new board from JSON. If you have a serialized board, you can
   * use this method to turn it into into a new Board instance.
   *
   * @param graph - the JSON representation of the board.
   * @returns - a new `Board` instance.
   */
  static async fromGraphDescriptor(graph: GraphDescriptor): Promise<Board> {
    const breadboard = new Board();
    breadboard.edges = graph.edges;
    breadboard.nodes = graph.nodes;
    const loader = new KitLoader(graph.kits);
    (await loader.load()).forEach((kit) => breadboard.addKit(kit));
    return breadboard;
  }

  /**
   * Loads a board from a URL or a file path.
   *
   * @param $ref - the URL or a file path to the board.
   * @param slots - optional slots to provide to the board.
   * @returns - a new `Board` instance.
   */
  static async load($ref: string, slots?: BreadboardSlotSpec): Promise<Board> {
    const url = new URL($ref, new URL(import.meta.url));
    const path = url.protocol === "file:" ? $ref : undefined;
    const graph = await loadGraph(path, $ref);
    const board = await Board.fromGraphDescriptor(graph);
    board.#slots = slots || {};
    return board;
  }
}
