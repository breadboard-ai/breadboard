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
    tags: ["experimental"],
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-runmodule-component",
    },
  },
  inputs: {
    $module: {
      description: "The Module to run.",
      title: "Module",
      behavior: ["config", "module"],
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
  $module: string;
};

async function runModule(
  { $module: _$module }: RunModuleInputs,
  _args: InputValues
) {
  return error("Run Module implementation is not available");
}

function error($error: string) {
  return { $error };
}
