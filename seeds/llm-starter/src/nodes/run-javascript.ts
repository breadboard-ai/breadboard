/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";
import vm from "node:vm";

// https://regex101.com/r/PeEmEW/1
const stripCodeBlock = (code: string) =>
  code.replace(/(?:```(?:js|javascript)?\n+)(.*)(?:\n+```)/gms, "$1");

const runInNode = async (code: string, functionName: string) => {
  const codeToRun = `${code}\n${functionName}();`;
  const context = vm.createContext({ console });
  const script = new vm.Script(codeToRun);
  const result = await script.runInNewContext(context);
  return String(result);
};

const runInBrowser = async (code: string, functionName: string) => {
  const runner = (code: string, functionName: string) => {
    return `${code}\nself.onmessage = () => self.postMessage(${functionName}())`;
  };

  const blob = new Blob([runner(code, functionName)], {
    type: "text/javascript",
  });

  const worker = new Worker(URL.createObjectURL(blob));
  const result = new Promise((resolve) => {
    worker.onmessage = (e) => resolve(e.data);
  });
  worker.postMessage("please");
  return result;
};

export default async (inputs: InputValues) => {
  const code = inputs["code"] as string;
  if (!code) throw new Error("Running JavaScript requires `code` input");
  const name = (inputs["name"] as string) || "run";
  const clean = stripCodeBlock(code);
  // A smart helper that senses the environment (browser or node) and uses
  // the appropriate method to run the code.
  const result =
    typeof window === "undefined"
      ? await runInNode(clean, name)
      : await runInBrowser(clean, name);
  return { result };
};
