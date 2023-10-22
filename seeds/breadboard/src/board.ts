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
} from "./types.js";

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
  BreadboardCapability,
} from "./types.js";

import { BoardRunner } from "./runner.js";
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
  #topClosure: Board | undefined;
  #acrossBoardsEdges: { edge: Edge; from: Board; to: Board }[] = [];

  /**
   * Core nodes. Breadboard won't function without these.
   * These are always included.
   */

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

    let board: Board;
    let input: BreadboardNode<In, InL> | undefined;
    if (typeof boardOrFunction === "function") {
      board = new Board();
      input = board.input<InL>();
      const output = board.output<OutL>();

      board.#topClosure = this.#topClosure ?? this;
      board.#topClosure.#closureStack.push(board);

      boardOrFunction(board, input, output);

      board.#topClosure.#closureStack.pop();
    } else {
      board = boardOrFunction as Board;
    }

    const node = new Node(
      this,
      undefined,
      "lambda",
      {
        board: { kind: "board", board } as BreadboardCapability,
        ...rest,
      },
      $id
    );

    // Process edges that span lambdas. We have to turn this into two wires:
    //  (1) From the input node in the child board to the destination node
    //  (2) From the source node to this node. If the source node is in a
    //      parent board, then instead ask parent to wire it up.
    if (input && board.#acrossBoardsEdges.length > 0) {
      for (const { edge, from, to } of board.#acrossBoardsEdges) {
        if (to !== board || !edge.constant)
          throw new Error(
            "Across board wires: Must be constant and from parent to child"
          );

        // Hopefully unique enough name that doesn't class with other inputs
        const label = `$l-${edge.to}-${edge.in}`;

        board.addEdge({ ...edge, from: input.id, out: label });

        const outerEdge = { ...edge, to: node.id, in: label };
        if (from === this) {
          this.addEdge(outerEdge);
        } else {
          this.addEdgeAcrossBoards(outerEdge, from, this);
        }
      }

      // Clear the edges, as they are now added to the board itself.
      // TODO: Add code in .run() to verify that all edges are consumed.
      board.#acrossBoardsEdges = [];
    }

    return node;
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

  /**
   * Used in the context of board.lambda(): Returns the board that is currently
   * being constructed, according to the nesting level of board.lambda() calls
   * with JS functions.
   *
   * Only called by Node constructor, when adding nodes.
   */
  currentBoardToAddTo(): Breadboard {
    const closureStack = this.#topClosure
      ? this.#topClosure.#closureStack
      : this.#closureStack;
    if (closureStack.length === 0) return this;
    else return closureStack[closureStack.length - 1];
  }

  /**
   *
   */
  addEdgeAcrossBoards(edge: Edge, from: Board, to: Board) {
    if (edge.out === "*")
      throw new Error("Across board wires: * wires not supported");

    if (!edge.constant)
      throw new Error("Across board wires: Must be constant for now");

    if (to !== this)
      throw new Error("Across board wires: Must be invoked on to board");

    const closureStack = this.#topClosure
      ? this.#topClosure.#closureStack
      : this.#closureStack;
    if (from !== this.#topClosure && !closureStack.includes(from))
      throw new Error("Across board wires: From must be parent of to");

    this.#acrossBoardsEdges.push({ edge, from, to });
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
  // Did we get a graph?
  const gotGraph =
    (config as GraphDescriptor).nodes !== undefined &&
    (config as GraphDescriptor).edges !== undefined &&
    (config as GraphDescriptor).kits !== undefined;

  // Look for functions, nodes and board capabilities.
  const gotBoard =
    gotGraph ||
    typeof config === "function" ||
    config instanceof Node ||
    ((config as BreadboardCapability).kind === "board" &&
      (config as BreadboardCapability).board);

  const result = (
    gotBoard
      ? { board: gotGraph ? { kind: "board", board: config } : config }
      : config
  ) as OptionalIdConfiguration;

  // Convert passed JS function into a board node.
  if (typeof result.board === "function")
    result.board = board.lambda(result.board as LambdaFunction<In, Out>);

  return result;
};
