/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, NodeHandlerObject } from "@google-labs/breadboard";

const runner = (code: string, functionName: string, args: string) => {
  // The addition of `globalThis.__name = () => {}` is to ensure that
  // if the function is compiled with esbuild --keep-names, the added "__name"
  // call does not cause a runtime error.
  // See https://github.com/privatenumber/tsx/issues/113 and
  // https://github.com/evanw/esbuild/issues/1031 for more details.
  return `${code}
  globalThis.__name = () => {};
  self.onmessage = async () => {
    try {
      self.postMessage({
        result: JSON.stringify((await ${functionName}(${args})))
      });
    } catch (e) {
      self.postMessage({
        error: e.message
      })
    }
  };
  self.onerror = (e) => self.postMessage({
    error: e.message
  })`;
};

// https://regex101.com/r/PeEmEW/1
const stripCodeBlock = (code: string) =>
  code.replace(/(?:```(?:js|javascript)?\n+)(.*)(?:\n+```)/gms, "$1");

// Copied from "secrets.ts".
// TODO: Clean this up, this feels like a util of some sort.
type Environment = "node" | "browser" | "worker" | "serviceWorker";

type ScriptRunner = (args: {
  code: string;
  functionName: string;
  args: string;
}) => Promise<string>;

const environment = (): Environment => {
  if (typeof globalThis.process !== "undefined") {
    return "node";
  }
  if (typeof globalThis.window !== "undefined") {
    return "browser";
  }
  if (
    "ServiceWorkerGlobalScope" in globalThis &&
    // @ts-expect-error -- ServiceWorkerGlobalScope is not defined.
    globalThis instanceof ServiceWorkerGlobalScope
  ) {
    return "serviceWorker";
  }
  return "worker";
};

const runInNode: ScriptRunner = async ({ code, functionName, args }) => {
  // TODO: This code does not work when used with esbuild. Esbuild provides
  // the "require" function anyway, and then throws an error when trying to
  // call it. Figure out what's the right thing to do here.
  // let vm;
  // if (typeof require === "function") {
  //   vm = require("node:vm");
  // } else {
  //   vm = await import(/*@vite-ignore*/ "node:vm");
  // }
  const vm = await import("node:vm");
  const codeToRun = `${code}\n${functionName}(${args});`;
  const context = vm.createContext({ console, structuredClone });
  const script = new vm.Script(codeToRun);
  const result = await script.runInNewContext(context);
  return JSON.stringify(result);
};

const runInServiceWorker: ScriptRunner = async ({
  code,
  functionName,
  args,
}) => {
  /* @vite-ignore */
  /* webpackIgnore: true */
  const body = `return (async function() { \n${code};\nreturn await ${functionName}(${args}) })();`;
  // Very very sorry.
  const f = new Function(body);
  const result = await f();
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
  const blob = new Blob([runner(code, functionName, args)], {
    type: "text/javascript",
  });

  type WebWorkerResultType = "error" | "result";
  type WebWorkerResult = {
    [x in WebWorkerResultType]: string;
  };

  const workerURL = URL.createObjectURL(blob);
  const worker = new Worker(workerURL, { type: "module" });
  const result = new Promise<string>((resolve, reject) => {
    worker.onmessage = (e) => {
      const data = e.data as WebWorkerResult;
      if (data.result) {
        resolve(data.result);
        URL.revokeObjectURL(workerURL);
        worker.terminate();
        return;
      } else if (data.error) {
        console.log("Error in worker", data.error);
        reject(new Error(data.error));
      }
    };
    worker.onerror = (e) => {
      const error =
        e.message ?? "Unknown script error (check syntax or grammar)";
      reject(new Error(error));
    };
  });
  worker.postMessage("please");
  return result;
};

export type RunJavascriptOutputs = Record<string, unknown> & {
  result: unknown;
};

type RunJavascriptInputs = InputValues & {
  code?: string;
  name?: string;
  raw?: boolean;
  schema?: InputValues;
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
const runJavascriptHandler = async (inputs: InputValues) => {
  // eslint-disable-next-line prefer-const
  let { code, name, raw, ...args } = inputs as RunJavascriptInputs;
  if (!code) throw new Error("Running JavaScript requires `code` input");
  code = stripCodeBlock(code);
  name ??= DEFAULT_FUNCTION_NAME;
  code = convertToNamedFunction({ funcStr: code, name });
  // A smart helper that senses the environment (browser or node) and uses
  // the appropriate method to run the code.
  const argsString = JSON.stringify(args);
  const env: Environment = environment();

  let runner: ScriptRunner;

  try {
    if (env === "node") {
      runner = runInNode;
    } else if (env === "browser") {
      runner = runInBrowser;
    } else if (env === "serviceWorker") {
      runner = runInServiceWorker;
    } else {
      throw new Error(`Unsupported environment: ${env}`);
    }
    const result = JSON.parse(
      await runner({ code, functionName: name, args: argsString })
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

export default {
  metadata: {
    title: "Run Javascript",
    description: "Runs supplied `code` input as Javascript.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-runjavascript-component",
    },
  },
  describe: async () => {
    return {
      inputSchema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            title: "Code",
            description: "The JavaScript code to run",
            format: "javascript",
            behavior: ["config", "hint-code"],
          },
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
            title: "Input Schema",
            description:
              "The schema of the input data, the function arguments.",
            behavior: ["config", "ports-spec"],
          },
          name: {
            type: "string",
            title: "Function Name",
            description:
              'The name of the function to invoke in the supplied code. Default value is "run".',
            default: "run",
            behavior: ["config"],
          },
          outputSchema: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
            title: "Output Schema",
            description:
              "The schema of the output data, the shape of the object of the function return value.",
            behavior: ["config", "ports-spec"],
          },
          raw: {
            type: "boolean",
            title: "Raw Output",
            description:
              "Whether or not to return use the result of execution as raw output (true) or as a port called `result` (false). Default is false.",
            default: false as unknown as string,
            behavior: ["config"],
          },
          schema: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
            title: "schema",
            description:
              "Deprecated! Please use inputSchema/outputSchema instead. The schema of the output data.",
            behavior: ["config", "ports-spec", "deprecated"],
          },
        },
        required: ["code"],
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        properties: {
          result: {
            type: ["array", "boolean", "null", "number", "object", "string"],
            title: "Result",
            description: "The result of running the JavaScript code",
          },
        },
        required: [],
        additionalProperties: true,
      },
    };
  },
  invoke: (inputs) => runJavascriptHandler(inputs),
} satisfies NodeHandlerObject;
