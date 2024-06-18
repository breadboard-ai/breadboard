/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, defineNodeType, object } from "@breadboard-ai/build";
import type {
  BoardOutputPorts,
  GenericBoardDefinition,
} from "@breadboard-ai/build/internal/board/board.js";
import type { Input } from "@breadboard-ai/build/internal/board/input.js";
import type { OutputPortReference } from "@breadboard-ai/build/internal/common/port.js";
import type { Expand } from "@breadboard-ai/build/internal/common/type-util.js";
import type { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import { getRunner } from "../utils.js";

/**
 * Apply the given board to all elements of the given array-type Breadboard
 * value.
 */
export function map<I extends JsonSerializable, O extends BoardOutputPorts>(
  list: OutputPortReference<Array<I>>,
  board: GenericBoardDefinition & {
    inputs: {
      item: Input<I>;
    };
    outputs: O;
  }
): OutputPortReference<Array<Expand<ExtractOutputTypes<O>>>> {
  return mapNode({ list, board }).outputs.list;
}

type ExtractOutputTypes<B extends BoardOutputPorts> = {
  [K in keyof B]: B[K] extends OutputPortReference<infer T>
    ? T extends undefined
      ? never
      : T
    : never;
};

const mapNode = defineNodeType({
  name: "map",
  metadata: {
    title: "Map",
    description:
      "Given a list and a board, iterates over this list (just like your usual JavaScript `map` function), invoking (runOnce) the supplied board for each item.",
  },
  inputs: {
    list: {
      title: "List",
      type: array("unknown"),
    },
    board: {
      title: "Board",
      type:
        // TODO(aomarks) An embedded board. Should have a better schema to use
        // here. Maybe with a JSON schema ID reference?
        object({}, "unknown"),
      // TODO(aomarks) There should alsobe a way to specify what the interface of
      // the board must be.
      behavior: ["board"],
      description: "The board to run for each element of the list.",
    },
  },
  outputs: {
    list: {
      title: "List",
      type: array(object({}, "unknown")),
      description: "The list of outputs from the board.",
    },
  },
  invoke: async ({ list, board }, _, context) => {
    // TODO(aomarks) Don't support this use case, just require an array.
    if (typeof list === "string") {
      try {
        list = JSON.parse(list);
      } catch (e) {
        throw new Error(
          `List was a string, tried and failed parsing it as JSON: ${list}`
        );
      }
    }
    if (!Array.isArray(list)) {
      // TODO(aomarks) This should get automatically detected and we shouldn't
      // be able to even get to invoke. We know the JSON schema up-front.
      throw new Error(`Expected list to be an array, but got ${list}`);
    }
    const runnableBoard = await getRunner(board, context);
    if (!runnableBoard) return { list };
    const result = await Promise.all(
      list.map(async (item, index) => {
        // TODO: Express as a multi-turn `run`.

        // If the current board has a URL, pass it as new base.
        // Otherwise, use the previous base.
        const base = context?.board?.url && new URL(context.board?.url);

        const newContext = {
          ...context,
          base: base || context?.base,
          invocationPath: [...(context?.invocationPath || []), index],
        };
        const outputs = await runnableBoard.runOnce(
          { item, index, list },
          newContext
        );
        // TODO(aomarks) Map functions have an "item" input, but not an "item"
        // output. Instead, all outputs become the map result. That's a bit
        // weird, since it means you can't e.g. map a string to a string; only a
        // string to an object containing a string. Let's try and migrate to a
        // symmetrical map type, will need an opt-in flag initially.
        return outputs;
      })
    );

    const errors = result.filter((r) => r.$error);
    if (errors.length === 0) {
      // Easy case, no errors. Just return the list.
      return { list: result };
    }
    // Return first error.
    // TODO: Implement showing multiple errors.
    // TODO: Consider returning the list of results, with errors in place.
    //       This would allow the user to see the results of the successful runs.
    return { $error: errors[0].$error };
  },
});
export default mapNode;
