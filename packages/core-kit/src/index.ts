/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import importHandler from "./nodes/import.js";
import include from "./nodes/include.js";
import invoke from "./nodes/invoke.js";
import resolve from "./nodes/resolve.js";
import passthrough from "./nodes/passthrough.js";
import reflect from "./nodes/reflect.js";
import slot from "./nodes/slot.js";
import map from "./nodes/map.js";
import reduce, { ReduceInputs, ReduceOutputs } from "./nodes/reduce.js";
import batch from "./nodes/batch.js";
import append from "./nodes/append.js";
import fetch from "./nodes/fetch.js";
import runJavascript from "./nodes/run-javascript.js";
import secrets from "./nodes/secrets.js";
import { unnestNode } from "./nodes/unnest.js";

export { code } from "./nodes/code.js";
export { default as fetch } from "./nodes/fetch.js";
export { default as invoke } from "./nodes/invoke.js";
export { default as passthrough } from "./nodes/passthrough.js";
export { default as runJavascript } from "./nodes/run-javascript.js";
export { secret, default as secrets } from "./nodes/secrets.js";
export { unnest, unnestNode } from "./nodes/unnest.js";
export { default as mapNode, map } from "./nodes/map.js";

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
   * reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#include)
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
   * reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#include)
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
   * Places a `resolve` node on the board.
   *
   * Use this node to resolve relative URLs to absolute URLs.
   *
   * `resolve` has one special input:
   *  - `$base`: The base URL to use for resolution. If not provided, the URL of
   *    the current graph is used by default.
   *
   * All other inputs will be resolved to absolute URLs and returned on output
   * ports with the same names as the corresponding input.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  resolve,

  /**
   * Places the `passthrough` node on the board.
   *
   * A `passthrough` node is a node that simply passes its inputs to
   * its outputs. Every computing machine needs a no-op node,
   * and Breadboard library is no exception.
   *
   * See [`passthrough` node reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#passthrough) for more information.
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
   * See [`reflect` node reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#reflect) for more information.
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
   * See [`slot` node reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#slot) for more information.
   *
   * @param config - optional configuration for the node.
   * @returns - a `Node` object that represents the placed node.
   */
  slot,

  /**
   * Use this node to accumulate local state, like context in a prompt.
   *
   * The node looks for property called `accumulator` in its input. All other
   * properties are appended to this property, and returned as `accumulator`
   * output property.
   *
   * The way the properties are appended depends on the type of the
   * `accumulator` input property.
   *
   * If the `accumulator` property is "string-ey" (that is, it's a `string`,
   * `number`, `boolean`, `bigint`, `null` or `undefined`), the properties will
   * be appended as strings, formatted as
   * `{{property_name}}: {{property_value}}` and joined with "`\n`".
   *
   * If the `accumulator` property is an array, the properties will be appended
   * as array items, formatted as `{{property_name}}: {{property_value}}`.
   *
   * Otherwise, the `accumulator` property will be treated as an object and
   * the properties will be added as properties on this object.
   *
   * See [`append` node reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/core-kit/README.md) for more information.
   *
   */
  append,

  /**
   * Work-in-progress implementation of the `map` node.
   * See #127 for more information.
   */
  map,
  reduce,
  batch,
  fetch,
  runJavascript,
  secrets,
  curry,

  /**
   * Converts all inline data to stored data, saving memory.
   * Useful when working with multimodal content. Safely passes
   * data through if it's already stored or no inline data is
   * present.
   */
  deflate,
  inflate,

  unnest: unnestNode,
});

export type Core = InstanceType<typeof Core>;

export default Core;

/**
 * This is a wrapper around existing kits for the new syntax to add types.
 *
 * This should transition to a codegen step, with typescript types constructed
 * from .describe() calls.
 */
import {
  addKit,
  NewNodeValue as NodeValue,
  NewInputValues as InputValues,
  NewOutputValues as OutputValues,
  NewNodeFactory as NodeFactory,
} from "@google-labs/breadboard";
import curry, { CurryInputs, CurryOutputs } from "./nodes/curry.js";
import deflate from "./nodes/deflate.js";
import inflate from "./nodes/inflate.js";
import { NodeFactoryFromDefinition } from "@breadboard-ai/build";

export type CoreKitType = {
  passthrough: NodeFactory<InputValues, OutputValues>;
  /**
   * Creates the `append` node, which can be used to accumulate local state,
   * like context in a prompt.
   *
   * The node looks for property called `accumulator` in its input. All other
   * properties are appended to this property, and returned as `accumulator`
   * output property.
   *
   * The way the properties are appended depends on the type of the
   * `accumulator` input property.
   *
   * If the `accumulator` property is "string-ey" (that is, it's a `string`,
   * `number`, `boolean`, `bigint`, `null` or `undefined`), the properties will
   * be appended as strings, formatted as
   * `{{property_name}}: {{property_value}}` and joined with "`\n`".
   *
   * If the `accumulator` property is an array, the properties will be appended
   * as array items, formatted as `{{property_name}}: {{property_value}}`.
   *
   * Otherwise, the `accumulator` property will be treated as an object and
   * the properties will be added as properties on this object.
   *
   * See [`append` node reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/core-kit/README.md) for more information.
   *
   */
  append: NodeFactory<
    { accumulator: NodeValue; [key: string]: NodeValue },
    { accumulator: NodeValue }
  >;
  /**
   * Creates an `invoke` node, which can be used invoke other boards within
   * the current board.
   *
   * See [`include` node
   * reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md#include)
   * for more information.
   *
   * Expects as input one of
   *  - `path`: A board to be loaded
   *  - `graph`: A graph (treated as JSON)
   *  - `board`: A {BreadboardCapability}, e.g. from lambda or import
   *
   * All other inputs are passed to the invoked board,
   * and the output are the invoked board's outputs.
   */
  invoke: NodeFactory<
    {
      /**
       * A board to be invoked.
       */
      $board: NodeValue;
      [key: string]: NodeValue;
    },
    { [key: string]: unknown }
  >;
  resolve: NodeFactory<{ [k: string]: string }, { [k: string]: string }>;
  map: NodeFactory<
    {
      list: NodeValue[];
      board?: NodeValue;
    },
    { list: NodeValue[] }
  >;
  reduce: NodeFactory<ReduceInputs, ReduceOutputs>;
  /**
   * Combines a board with some arguments to create a new board (aka currying).
   * The arguments in that board will run as part of board invocation as if
   * they were supplied as inputs.
   */
  curry: NodeFactory<CurryInputs, CurryOutputs>;
  fetch: NodeFactory<
    { url: string },
    {
      response: string;
      status: number;
      statusText: string;
      contentType?: string;
      responseHeaders?: object;
    }
  >;
  runJavascript: NodeFactory<
    {
      code: string;
      name: string;
      raw: boolean;
      [key: string]: NodeValue;
    },
    { result: unknown; [k: string]: unknown }
  >;
  secrets: NodeFactory<{ keys: string[] }, { [k: string]: string }>;
  unnest: NodeFactoryFromDefinition<typeof unnestNode>;
  // TODO: Other Core nodes.
};

/**
 * The Core Kit. Use members of this object to create nodes to enable
 * composition and reuse of in Breadboard. The most useful node is `invoke`,
 * which allows you to invoke other boards within the current board.
 * Another useful one is `map`, which allows you to map over a list of items
 * and invoke a board for each item.
 */
export const core = addKit(Core) as unknown as CoreKitType;
