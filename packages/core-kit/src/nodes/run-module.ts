/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, object, unsafeSchema } from "@breadboard-ai/build";
import { InputValues } from "@google-labs/breadboard";

export default defineNodeType({
  name: "runModule",
  metadata: {
    title: "Run Module",
    description: "Runs a supplied ECMAScript module.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-runmodule-component",
    },
  },
  inputs: {
    $code: {
      description:
        "The JavaScript code to run. Must be a module with a default export that takes in one object as input argument and returns an object.",
      title: "Code",
      behavior: ["config", "code"],
      format: "javascript",
      type: "string",
    },
    $inputSchema: {
      title: "Input Schema",
      description:
        "The schema that defines the shape of the input argument object.",
      behavior: ["config", "ports-spec"],
      type: object({}, "unknown"),
      optional: true,
    },
    $outputSchema: {
      title: "Output Schema",
      behavior: ["config", "ports-spec"],
      description:
        "The schema of the output data, which defines the shape of the return value.",
      type: object({}, "unknown"),
      optional: true,
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  describe: ({ $inputSchema, $outputSchema }) => {
    return {
      inputs: $inputSchema ? unsafeSchema($inputSchema) : { "*": "unknown" },
      outputs: $outputSchema ? unsafeSchema($outputSchema) : { "*": "unknown" },
    };
  },
  invoke: (config, args) => {
    if (typeof globalThis.window === "undefined") {
      return error(
        "The `runModule` component currently only works in the browser."
      );
    }
    return runModule(config, args);
  },
});

type RunModuleInputs = {
  $code: string;
};

async function runModule({ $code: code }: RunModuleInputs, args: InputValues) {
  const codeUrl = URL.createObjectURL(
    new Blob([code], { type: "application/javascript" })
  );
  try {
    const result = (
      await import(/* @vite-ignore */ /* webpackIgnore: true */ codeUrl)
    ).default(args);
    return result;
  } catch (e) {
    return error((e as Error).message);
  } finally {
    URL.revokeObjectURL(codeUrl);
  }
}

function error($error: string) {
  return { $error };
}
