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

import {
  type Breadboard,
  type Kit,
  type KitConstructor,
  type OptionalIdConfiguration,
  BreadboardNode,
  LambdaFunction,
  LambdaNodeOutputs,
  ReflectNodeOutputs,
  IncludeNodeInputs,
  SlotNodeInputs,
  BreadboardCapability,
} from "./types.js";

import { BoardRunner } from "./runner.js";
import { toMermaid } from "@google-labs/graph-runner";
import { Node } from "./node.js";
import { lambda } from "./lambda.js";

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
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  input<In = InputValues, Out = OutputValues>(
    config: OptionalIdConfiguration = {}
  ): Node<In, Out> {
    const { $id, ...rest } = config;
    return new Node(this, "input", { ...rest }, $id);
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

  lambda<In, InL extends In, OutL = OutputValues>(
    board: LambdaFunction<InL, OutL> | Board,
    config: OptionalIdConfiguration = {}
  ): BreadboardNode<In, LambdaNodeOutputs> {
    const { $id, ...rest } = config;

    return new Node(
      this,
      "lambda",
      {
        board:
          typeof board === "function"
            ? lambda(board)
            : ({
                kind: "board",
                board: board as Board,
              } as BreadboardCapability),
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
      return new Node(this, "include", { $ref, ...rest }, $id);
    } else if (($ref as BreadboardCapability).kind === "board") {
      return new Node(this, "include", { board: $ref, ...rest }, $id);
    } else {
      return new Node(this, "include", { graph: $ref, ...rest }, $id);
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
}
