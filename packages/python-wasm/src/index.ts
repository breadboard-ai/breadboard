/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeFactoryFromDefinition } from "@breadboard-ai/build";
import { addKit } from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";
import { runPython } from "./run-python.js";

const PythonWasmKit = new KitBuilder({
  title: "Python Wasm Kit",
  description: "An example kit",
  version: "0.1.0",
  url: "npm:@breadboard-ai/python-wasm",
}).build({ runPython });
export default PythonWasmKit;

export const pythonWasmKit = addKit(PythonWasmKit) as {
  runPython: NodeFactoryFromDefinition<typeof runPython>;
};
