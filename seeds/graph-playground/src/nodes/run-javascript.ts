/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTraversalContext, InputValues } from "../graph.js";
import vm from "node:vm";

// https://regex101.com/r/PeEmEW/1
const stripCodeBlock = (code: string) =>
  code.replace(/(?:```(?:js|javascript)?\n+)(.*)(?:\n+```)/gms, "$1");

const runCode = async (code: string) => {
  const context = vm.createContext({ console });
  const script = new vm.Script(code);
  const result = await script.runInNewContext(context);
  return String(result);
};

export default async (_cx: GraphTraversalContext, inputs: InputValues) => {
  const code = inputs["code"] as string;
  if (!code) throw new Error("Running JavaScript requires `code` input");
  const name = (inputs["name"] as string) || "run";
  const clean = stripCodeBlock(code);
  const result = await runCode(`${clean}\n${name}();`);
  return { result };
};
