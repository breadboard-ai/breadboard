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

const runInNode = async ({
  code,
  functionName,
  args,
}: {
  code: string;
  functionName: string;
  args: string;
}): Promise<string> => {
  let vm;
  if (typeof require === "function") {
    vm = require("node:vm");
  } else {
    vm = await import(/*@vite-ignore*/ "node:vm");
  }
  const codeToRun = `${code}\n${functionName}(${args});`;
  const context = vm.createContext({ console });
  const script = new vm.Script(codeToRun);
  const result = await script.runInNewContext(context);
  return JSON.stringify(result);
};

const runInBrowser = async ({
  code,
  functionName,
  args,
}: {
  code: string;
  functionName: string;
  args: string;
}): Promise<string> => {
  const runner = (code: string, functionName: string) => {
    return `${code}\nself.onmessage = () => self.postMessage({ result: JSON.stringify(${functionName}(${args})) });self.onerror = (e) => self.postMessage({ error: e.message })`;
  };

  const blob = new Blob([runner(code, functionName)], {
    type: "text/javascript",
  });

  type WebWorkerResultType = "error" | "result";
  type WebWorkerResult = {
    [x in WebWorkerResultType]: string;
  };

  const worker = new Worker(URL.createObjectURL(blob));
  const result = new Promise<string>((resolve, reject) => {
    worker.onmessage = (e) => {
      const data = e.data as WebWorkerResult;
      if (data.result) {
        resolve(data.result);
        return;
      } else if (data.error) {
        reject(new Error(data.error));
      }
    };
    worker.onerror = (e) => {
      reject(new Error(e.message));
    };
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

export function convertToNamedFunction({
  funcStr,
  name = DEFAULT_FUNCTION_NAME,
  throwOnNameMismatch = false,
}: {
  funcStr: string;
  name?: string;
  throwOnNameMismatch?: boolean;
}): string {
  // Regular expressions to identify different types of functions
  const arrowFuncRegex = /^\s*((?:\((?:.|\n)*?\)|\w+)\s*=>\s*((?:.|\n)*))$/;
  const namedFuncRegex = /^\s*function\s+[A-Za-z0-9_$]+\s*\(/;
  const anonymousFuncRegex = /^\s*function\s*\(/;

  // Check if it's an arrow function
  if (arrowFuncRegex.test(funcStr)) {
    let [args, body] = funcStr.split("=>").map((s) => s.trim());
    // Add parentheses around single argument if not present
    if (!args.startsWith("(")) {
      args = `(${args})`;
    }
    if (!body.startsWith("{")) {
      // If the body is a single expression, enclose it in braces
      body = `{ return ${body}; }`;
    }
    return `function ${name}${args} ${body}`;
  }
  // Check if it's a named function
  else if (namedFuncRegex.test(funcStr)) {
    if (throwOnNameMismatch) {
      const match = funcStr.match(/function\s+([A-Za-z0-9_$]+)\s*\(/);
      const existingFunctionName = match ? match[1] : null;
      if (existingFunctionName !== name) {
        throw new Error(
          `Function name mismatch: ${existingFunctionName} !== ${name}`
        );
      }
    }
    return funcStr.replace(namedFuncRegex, `function ${name}(`);
  }
  // Check if it's an anonymous function
  else if (anonymousFuncRegex.test(funcStr)) {
    return funcStr.replace(anonymousFuncRegex, `function ${name}(`);
  }
  // If it's not a recognizable function format
  else {
    // Do not throw, since it could be a function format that this helper
    // does not yet handle.
    // Could also be a named function already.
    return funcStr;
  }
}

const DEFAULT_FUNCTION_NAME = "run";
export const runJavascriptHandler: NodeHandlerFunction = async ({
  code,
  name,
  raw,
  ...args
}: InputValues & RunJavascriptInputs) => {
  if (!code) throw new Error("Running JavaScript requires `code` input");
  code = stripCodeBlock(code);
  name ??= DEFAULT_FUNCTION_NAME;
  code = convertToNamedFunction({ funcStr: code, name });
  // A smart helper that senses the environment (browser or node) and uses
  // the appropriate method to run the code.
  const argsString = JSON.stringify(args);
  const env = environment();

  try {
    const result = JSON.parse(
      env === "node"
        ? await runInNode({ code, functionName: name, args: argsString })
        : await runInBrowser({ code, functionName: name, args: argsString })
    );
    return raw ? result : { result };
  } catch (e) {
    // Remove everything outside eval from the stack trace
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
