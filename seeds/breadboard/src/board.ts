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
  GraphMetadata,
} from "@google-labs/graph-runner";

import {
  type Breadboard,
  type BreadboardSlotSpec,
  type Kit,
  type KitConstructor,
  type OptionalIdConfiguration,
  type BreadboardValidator,
  ProbeDetails,
  BreadboardNode,
  ReflectNodeOutputs,
  IncludeNodeInputs,
  SlotNodeInputs,
} from "./types.js";

import { TraversalMachine, toMermaid } from "@google-labs/graph-runner";
import { Node } from "./node.js";
import { Core } from "./core.js";
import {
  BeforeHandlerStageResult,
  InputStageResult,
  OutputStageResult,
  RunResult,
} from "./run.js";
import { KitLoader } from "./kit.js";
import { IdVendor } from "./id.js";
import { BoardLoader } from "./loader.js";

class ProbeEvent extends CustomEvent<ProbeDetails> {
  constructor(type: string, detail: ProbeDetails) {
    super(type, { detail, cancelable: true });
  }
}

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
  url?: string;
  title?: string;
  description?: string;
  version?: string;
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  kits: Kit[] = [];
  #localKit?: LocalKit;
  #slots: BreadboardSlotSpec = {};
  #validators: BreadboardValidator[] = [];

  /**
   *
   * @param metadata - optional metadata for the board. Use this parameter
   * to provide title, description, version, and URL for the board.
   */
  constructor(metadata?: GraphMetadata) {
    const { url, title, description, version } = metadata || {};
    Object.assign(this, { url, title, description, version });
  }

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
   * The `stop` iterator result will be a `RunResult` and provide ability
   * to influence running of the board.
   *
   * The two key use cases are providing input and receiving output.
   *
   * If `stop.type` is `input`, the board is waiting for input values.
   * When that is the case, use `stop.inputs` to provide input values.
   *
   * If `stop.type` is `output`, the board is providing output values.
   * When that is the case, use `stop.outputs` to receive output values.
   *
   * See [Chapter 8: Continuous runs](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial for an example of how to use this method.
   *
   * @param probe - an optional probe. If provided, the board will dispatch
   * events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information.
   * @param slots - an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information.
   */
  async *run(
    probe?: EventTarget,
    slots?: BreadboardSlotSpec,
    result?: RunResult
  ): AsyncGenerator<RunResult> {
    const core = new Core(
      this,
      { ...this.#slots, ...slots },
      this.#validators,
      probe
    );
    const kits = [core, ...this.kits];
    const handlers = kits.reduce((handlers, kit) => {
      return { ...handlers, ...kit.handlers };
    }, {} as NodeHandlers);

    this.#validators.forEach((validator) => validator.addGraph(this));

    const machine = new TraversalMachine(this, result?.state);

    for await (const result of machine) {
      const { inputs, descriptor, missingInputs } = result;

      if (result.skip) {
        probe?.dispatchEvent(
          new ProbeEvent("skip", { descriptor, inputs, missingInputs })
        );
        continue;
      }

      if (descriptor.type === "input") {
        yield new InputStageResult(result);
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
        yield new OutputStageResult(result);
        continue;
      }

      // The include and slot handlers require a reference to themselves to
      // create subgraph validators at the right location in the graph.
      if (["include", "slot"].includes(descriptor.type))
        inputs["parent"] = descriptor;

      const handler = handlers[descriptor.type];
      if (!handler)
        throw new Error(`No handler for node type "${descriptor.type}"`);

      const beforehandlerDetail = {
        descriptor,
        inputs,
        outputs: {},
      };

      yield new BeforeHandlerStageResult(result);

      const shouldInvokeHandler =
        !probe ||
        probe.dispatchEvent(
          new ProbeEvent("beforehandler", beforehandlerDetail)
        );

      const outputs = (
        shouldInvokeHandler
          ? await handler(inputs)
          : beforehandlerDetail.outputs
      ) as OutputValues;

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
   * @param slots - an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information.
   * @returns - outputs provided by the board.
   */
  async runOnce(
    inputs: InputValues,
    probe?: EventTarget,
    slots?: BreadboardSlotSpec
  ): Promise<OutputValues> {
    let outputs: OutputValues = {};
    for await (const result of this.run(probe, slots)) {
      if (result.type === "input") {
        result.inputs = inputs;
      } else if (result.type === "output") {
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
  passthrough<In = InputValues, Out = OutputValues>(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In, Out> {
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
  input<In = InputValues, Out = OutputValues>(
    message?: string,
    config: OptionalIdConfiguration = {}
  ): Node<In, Out> {
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
  output<In = InputValues, Out = OutputValues>(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In, Out> {
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
  include<In = InputValues, Out = OutputValues>(
    $ref: string | GraphDescriptor,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<IncludeNodeInputs & In, Out> {
    const { $id, ...rest } = config;
    if (typeof $ref === "string") {
      return new Node(this, "include", { $ref, ...rest }, $id);
    }
    return new Node(this, "include", { graph: $ref, ...rest }, $id);
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
  reflect(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<never, ReflectNodeOutputs> {
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
  slot<In = InputValues, Out = OutputValues>(
    slot: string,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<SlotNodeInputs & In, Out> {
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
  node<In = InputValues, Out = OutputValues>(
    handler: NodeHandler,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In, Out> {
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
    const kit = new ctr({
      create: (...args) => {
        return new Node(this, ...args);
      },
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
    const breadboard = new Board(graph);
    breadboard.edges = graph.edges;
    breadboard.nodes = graph.nodes;
    const loader = new KitLoader(graph.kits);
    (await loader.load()).forEach((kit) => breadboard.addKit(kit));
    return breadboard;
  }

  /**
   * Loads a board from a URL or a file path.
   *
   * @param url - the URL or a file path to the board.
   * @param slots - optional slots to provide to the board.
   * @returns - a new `Board` instance.
   */
  static async load(
    url: string,
    options?: { slotted?: BreadboardSlotSpec; base?: string }
  ): Promise<Board> {
    const { base, slotted } = options || {};
    const loader = new BoardLoader(base);
    const graph = await loader.load(url);
    const board = await Board.fromGraphDescriptor(graph);
    board.#slots = slotted || {};
    return board;
  }
}
