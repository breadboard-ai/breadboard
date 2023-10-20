/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriberFunction,
  NodeHandler,
  NodeHandlerFunction,
  Schema,
} from "@google-labs/breadboard";

// https://regex101.com/r/PeEmEW/1
const stripCodeBlock = (code: string) =>
  code.replace(/(?:```(?:js|javascript)?\n+)(.*)(?:\n+```)/gms, "$1");

// Copied from "secrets.ts".
// TODO: Clean this up, this feels like a util of some sort.
type Environment = "node" | "browser" | "worker";

const environment = (): Environment =>
  typeof globalThis.process !== "undefined"
    ? "node"
    : typeof globalThis.window !== "undefined"
    ? "browser"
    : "worker";

const runInNode = async (
  code: string,
  functionName: string,
  args: string
): Promise<string> => {
  const vm = await import(/*@vite-ignore*/ "node:vm");
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
    return `${code}\nself.onmessage = () => self.postMessage(JSON.stringify(${functionName}(${args})))`;
  };

  const blob = new Blob([runner(code, functionName)], {
    type: "text/javascript",
  });

  const worker = new Worker(URL.createObjectURL(blob));
  const result = new Promise<string>((resolve) => {
    worker.onmessage = (e) => resolve(e.data);
  });
  worker.postMessage("please");
  return result;
};

export type RunJavascriptOutputs = Record<string, unknown> & {
  result: unknown;
};

export type RunJavascriptInputs = InputValues & {
  code?: string;
  name?: string;
  raw?: boolean;
};

export const runJavascriptHandler: NodeHandlerFunction = async (
  inputs: InputValues
) => {
  const { code, name, raw, ...args } = inputs as RunJavascriptInputs;
  if (!code) throw new Error("Running JavaScript requires `code` input");
  const clean = stripCodeBlock(code);
  // A smart helper that senses the environment (browser or node) and uses
  // the appropriate method to run the code.
  const functionName = name || "run";
  const argsString = JSON.stringify(args);
  const env = environment();

  try {
    const result = JSON.parse(
      env === "node"
        ? await runInNode(clean, functionName, argsString)
        : await runInBrowser(clean, functionName, argsString)
    );
    return raw ? result : { result };
  } catch (e) {
    // Remove everthing outside eval from the stack trace
    const stack = (e as Error).stack;
    if (stack !== undefined) {
      (e as Error).stack = stack
        .split("\n")
        .filter(
          (line) =>
            !line.startsWith("    at") ||
            line.includes("evalmachine.<anonymous>")
        )
        .join("\n");
    }
    return { $error: { kind: "error", error: e } };
  }
};

export const computeOutputSchema = (inputs: InputValues): Schema => {
  if (!inputs || !inputs.raw)
    return {
      type: "object",
      properties: {
        result: {
          title: "result",
          description: "The result of running the JavaScript code",
          type: ["string", "object"],
        },
      },
      required: ["result"],
    };
  return {
    type: "object",
    additionalProperties: true,
  };
};

type SchemaProperties = Schema["properties"];

export const computeAdditionalInputs = (
  inputsSchema?: SchemaProperties
): SchemaProperties => {
  if (!inputsSchema) return {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { code, name, raw, ...args } = inputsSchema;
  return args;
};

export const runJavascriptDescriber: NodeDescriberFunction = async (
  inputs?: InputValues,
  inputsSchema?: Schema
) => {
  return {
    inputSchema: {
      type: "object",
      properties: {
        code: {
          title: "code",
          description: "The JavaScript code to run",
          type: "string",
        },
        name: {
          title: "name",
          description:
            'The name of the function to invoke in the supplied code. Default value is "run".',
          type: "string",
          default: "run",
        },
        raw: {
          title: "raw",
          description:
            "Whether or not to return use the result of execution as raw output (true) or as a port called `result` (false). Default is false.",
          type: "boolean",
        },
        ...computeAdditionalInputs(inputsSchema?.properties || {}),
      },
      required: ["code"],
      additionalProperties: true,
    },
    outputSchema: computeOutputSchema(inputs || {}),
  };
};

export default {
  describe: runJavascriptDescriber,
  invoke: runJavascriptHandler,
} satisfies NodeHandler;
