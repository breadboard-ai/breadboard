/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  NodeDescriptor,
  InputValues,
  GraphDescriptor,
  OutputValues,
} from "@google-labs/graph-runner";

import type {
  Breadboard,
  BreadboardRunner,
  Kit,
  KitConstructor,
  OptionalIdConfiguration,
  ConfigOrLambda,
  LambdaFunction,
  BreadboardNode,
  LambdaNodeOutputs,
  ReflectNodeOutputs,
  IncludeNodeInputs,
  SlotNodeInputs,
  BreadboardCapability,
} from "./types.js";

import { BoardRunner } from "./runner.js";
import { toMermaid } from "@google-labs/graph-runner";
import { Node } from "./node.js";

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
export class Board extends BoardRunner implements Breadboard {
  #closureStack: Board[] = [];

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
    return new Node(this, undefined, "passthrough", { ...rest }, $id);
  }

  /**
   * Places an `input` node on the board.
   *
   * An `input` node is a node that asks for inputs from the user.
   *
   * See [`input` node reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#input) for more information.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  input<In = InputValues, Out = OutputValues>(
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In, Out> {
    const { $id, ...rest } = config;
    return new Node(this, undefined, "input", { ...rest }, $id);
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
    return new Node(this, undefined, "output", { ...rest }, $id);
  }

  /**
   * Place a `lambda` node on the board.
   *
   * It is a node that represents a subgraph of nodes. It can be passed to
   * `invoke` or nodes like `map` (defined in another kit) that invoke boards.
   *
   * Input wires are made available as input values to the lambda board.
   *
   * `board` is the only output and represents a BoardCapability that invoke and
   * others consume.
   *
   * You can either pass a `Board` or a Javascript function to this method. The
   * JS function is called with a `board` to add things to, and for convenience,
   * input and output nodes attached to the board.
   *
   * Example: board.lambda((board, input, output) => { input.wire( "item->item",
   * kit.someNode().wire( "value->value", output));
   * });
   *
   * @param boardOrFunction A board or a function that builds the board
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  lambda<In, InL extends In, OutL = OutputValues>(
    boardOrFunction: LambdaFunction<InL, OutL> | BreadboardRunner,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In, LambdaNodeOutputs> {
    const { $id, ...rest } = config;

    let capability: BreadboardCapability;
    if (typeof boardOrFunction === "function") {
      const board = new Board();
      const input = board.input<InL>();
      const output = board.output<OutL>();

      this.#closureStack.push(board);
      boardOrFunction(board, input, output);
      this.#closureStack.pop();

      capability = { kind: "board", board };
    } else {
      capability = { kind: "board", board: boardOrFunction };
    }

    return new Node(
      this,
      undefined,
      "lambda",
      {
        board: capability,
        ...rest,
      },
      $id
    );
  }

  /**
   * Places an `include` node on the board.
   *
   * Use this node to include other boards into the current board.
   *
   * The `include` node acts as a sort of instant board-to-node converter: just
   * give it the URL of a serialized board, and it will pretend as if that whole
   * board is just one node.
   *
   * See [`include` node
   * reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#include)
   * for more information.
   *
   * @param $ref - the URL of the board to include, or a graph or a
   *   BreadboardCapability returned by e.g. lambda.
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  include<In = InputValues, Out = OutputValues>(
    $ref: string | GraphDescriptor | BreadboardCapability,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<IncludeNodeInputs & In, Out> {
    const { $id, ...rest } = config;
    if (typeof $ref === "string") {
      return new Node(this, undefined, "include", { $ref, ...rest }, $id);
    } else if (($ref as BreadboardCapability).kind === "board") {
      return new Node(
        this,
        undefined,
        "include",
        { board: $ref, ...rest },
        $id
      );
    } else {
      return new Node(
        this,
        undefined,
        "include",
        { graph: $ref, ...rest },
        $id
      );
    }
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
    return new Node(this, undefined, "reflect", { ...rest }, $id);
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
    return new Node(this, undefined, "slot", { slot, ...rest }, $id);
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
      getConfigWithLambda: <Inputs, Outputs>(
        config: ConfigOrLambda<Inputs, Outputs>
      ): OptionalIdConfiguration => {
        return getConfigWithLambda(this, config);
      },
    });
    this.kits.push(kit);
    return kit;
  }

  currentBoardToAddTo(): Breadboard {
    return this.#closureStack[this.#closureStack.length - 1] ?? this;
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
}

/**
 * Synctactic sugar for node factories that accept lambdas. This allows passing
 * either
 *  - A JS function that is a lambda function defining the board
 *  - A board capability, i.e. the result of calling lambda()
 *  - A board node, which should be a node with a `board` output
 * or
 *  - A regular config, with a `board` property with any of the above.
 *
 * @param config {ConfigOrLambda} the overloaded config
 * @returns {NodeConfigurationConstructor} config with a board property
 */
const getConfigWithLambda = <In = InputValues, Out = OutputValues>(
  board: Board,
  config: ConfigOrLambda<In, Out>
): OptionalIdConfiguration => {
  // Look for functions, nodes and board capabilities.
  const gotBoard =
    typeof config === "function" ||
    config instanceof Node ||
    ((config as BreadboardCapability).kind === "board" &&
      (config as BreadboardCapability).board);

  const result = (
    gotBoard ? { board: config } : config
  ) as OptionalIdConfiguration;

  // Convert passed JS function into a board node.
  if (typeof result.board === "function")
    result.board = board.lambda(result.board as LambdaFunction<In, Out>);

  return result;
};
