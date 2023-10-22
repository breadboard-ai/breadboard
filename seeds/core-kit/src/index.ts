/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import importHandler from "./nodes/import.js";
import include from "./nodes/include.js";
import invoke from "./nodes/invoke.js";
import passthrough from "./nodes/passthrough.js";
import reflect from "./nodes/reflect.js";
import slot from "./nodes/slot.js";

const builder = new KitBuilder({
  title: "Core Kit",
  description: "A Breadboard kit that enables composition and reuse of boards",
  version: "0.0.1",
  url: "npm:@google-labs/core-kit",
});

export const Core = builder.build({
  /**
   * Places an `import` node on the board.
   *
   * Use this node to import other boards into the current board.
   * Outputs `board` as a BoardCapability, which can be passed to e.g. `invoke`.
   *
   * The config param expects either `path` or `graph` as a string or
   * `GraphDescriptor', respectively.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  import: importHandler,

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
  include,

  /**
   * Places an `invoke` node on the board.
   *
   * Use this node to invoke other boards into the current board.
   *
   * See [`include` node
   * reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#include)
   * for more information.
   *
   * Expects as input one of
   *  - `path`: A board to be loaded
   *  - `graph`: A graph (treated as JSON)
   *  - `board`: A {BreadboardCapability}, e.g. from lambda or import
   *
   * All other inputs are passed to the invoked board,
   * and the output are the invoked board's outputs.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  invoke,
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
  passthrough,

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
  reflect,

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
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  slot,
});

export type Core = InstanceType<typeof Core>;

export default Core;
