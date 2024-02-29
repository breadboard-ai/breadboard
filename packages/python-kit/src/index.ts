/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

const builder = new KitBuilder({
  title: "Python Kit",
  description: "A Breadboard kit that is implemented in Python",
  version: "0.0.1",
  url: "npm:@google-labs/python-kit",
});

/*
Load python file with.. pythonia?
Or, just load it as text?
*/
import { python } from "pythonia";
// Import tkinter
const echo = await python("../../src/echo.py");
import fs from "fs";

const pythonCode = await fs.readFile("../../src/echo.py");
console.log(pythonCode);
// All Python API access must be prefixed with await
const root = await echo.a;
// A function call with a $ suffix will treat the last argument as a kwarg dict
const echoHandler = {
  describe: await root.describe,
  invoke: async (_inputs): Promise<OutputValues> => {
    return pythonCode;
  },
  //await root.invoke,
  /*async (inputs: InputValues): Promise<OutputValues> => {
    await root.invoke;
  },*/
  //code: pythonCode,
};
//python.exit();

//const echoHandler = loadPythonFile("echo.py");

export const PythonA = builder.build({
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
  testing: echoHandler,
});

export type PythonA = InstanceType<typeof PythonA>;

export default PythonA;

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

export type PythonKitType = {
  testing: NodeFactory<InputValues, OutputValues>;
};

/**
 * The Core Kit. Use members of this object to create nodes to enable
 * composition and reuse of in Breadboard. The most useful node is `invoke`,
 * which allows you to invoke other boards within the current board.
 * Another useful one is `map`, which allows you to map over a list of items
 * and invoke a board for each item.
 */
export const pythona = addKit(PythonA) as unknown as PythonKitType;
