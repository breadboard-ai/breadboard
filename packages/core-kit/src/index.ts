/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import fetch from "./nodes/fetch.js";
import invoke from "./nodes/invoke.js";
import runJavascript from "./nodes/run-javascript.js";
import runModule from "./nodes/run-module.js";
import secrets from "./nodes/secrets.js";

export { default as fetch } from "./nodes/fetch.js";
export { default as invoke } from "./nodes/invoke.js";
export { default as runJavascript } from "./nodes/run-javascript.js";
export { default as runModule } from "./nodes/run-module.js";
export { secret, default as secrets } from "./nodes/secrets.js";

const metadata = {
  title: "Core Kit",
  description: "A Breadboard kit that enables composition and reuse of boards",
  version: "0.0.1",
  url: "npm:@google-labs/core-kit",
};

const builder = new KitBuilder(metadata);

export const Core = builder.build({
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
  fetch,
  runJavascript,
  runModule,
  secrets,
});

export type Core = InstanceType<typeof Core>;

export default Core;

/**
 * This is a wrapper around existing kits for the new syntax to add types.
 *
 * This should transition to a codegen step, with typescript types constructed
 * from .describe() calls.
 */
import { kit } from "@breadboard-ai/build";
import {
  addKit,
  NewNodeFactory as NodeFactory,
  NewNodeValue as NodeValue,
} from "@google-labs/breadboard";

export type CoreKitType = {
  /**
   * Creates an `invoke` node, which can be used invoke other boards within
   * the current board.
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
};

/**
 * The Core Kit. Use members of this object to create nodes to enable
 * composition and reuse of in Breadboard. The most useful node is `invoke`,
 * which allows you to invoke other boards within the current board.
 * Another useful one is `map`, which allows you to map over a list of items
 * and invoke a board for each item.
 */
export const core = addKit(Core) as unknown as CoreKitType;

export const coreKit = await kit({
  ...metadata,
  components: {
    fetch,
    invoke,
    runJavascript,
    runModule,
    secrets,
  },
});
