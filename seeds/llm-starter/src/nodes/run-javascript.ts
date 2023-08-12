/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

// https://regex101.com/r/PeEmEW/1
const stripCodeBlock = (code: string) =>
  code.replace(/(?:```(?:js|javascript)?\n+)(.*)(?:\n+```)/gms, "$1");

const runInNode = async (
  code: string,
  functionName: string,
  args: string
): Promise<string> => {
  const vm = await import("node:vm");
  const codeToRun = `${code}\n${functionName}(${args});`;
  const context = vm.createContext({ console });
  const script = new vm.Script(codeToRun);
  const result = await script.runInNewContext(context);
  return JSON.stringify(result);
};

const runInBrowser = async (
  code: string,
  functionName: string,
  args: string
): Promise<string> => {
  const runner = (code: string, functionName: string) => {
    return `${code}\nself.onmessage = () => self.postMessage(JSON.stringify(${functionName}({${args}})))`;
  };

  const blob = new Blob([runner(code, functionName)], {
    type: "text/javascript",
  });

  const worker = new Worker(URL.createObjectURL(blob));
  const result = new Promise((resolve) => {
    worker.onmessage = (e) => resolve(e.data);
  });
  worker.postMessage("please");
  return String(result);
};

export type RunJavascriptOutputs = Record<string, unknown> & {
  result: unknown;
};

export type RunJavascriptInputs = InputValues & {
  code?: string;
  name?: string;
  raw?: boolean;
};

export default async (inputs: InputValues) => {
  const { code, name, raw, ...args } = inputs as RunJavascriptInputs;
  if (!code) throw new Error("Running JavaScript requires `code` input");
  const clean = stripCodeBlock(code);
  // A smart helper that senses the environment (browser or node) and uses
  // the appropriate method to run the code.
  const functionName = name || "run";
  const argsString = JSON.stringify(args);
  const result = JSON.parse(
    typeof window === "undefined"
      ? await runInNode(clean, functionName, argsString)
      : await runInBrowser(clean, functionName, argsString)
  );
  return raw ? result : { result };
};
