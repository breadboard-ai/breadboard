/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, object, unsafeSchema } from "@breadboard-ai/build";
import { InputValues } from "@google-labs/breadboard";

import {
  ConsoleStdout,
  File as WasiFile,
  OpenFile,
  WASI,
} from "@bjorn3/browser_wasi_shim";

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
  return runModuleWithJsandbox(code, args);
}

function error($error: string) {
  return { $error };
}

async function runModuleAsBlob(code: string, inputs: InputValues) {
  const codeUrl = URL.createObjectURL(
    new Blob([code], { type: "application/javascript" })
  );
  try {
    const result = (
      await import(/* @vite-ignore */ /* webpackIgnore: true */ codeUrl)
    ).default(inputs);
    return result;
  } catch (e) {
    return error((e as Error).message);
  } finally {
    URL.revokeObjectURL(codeUrl);
  }
}

async function runModuleWithJsandbox(code: string, inputs: InputValues) {
  const path = new URL("/jsandbox/jsandbox_bg.wasm", window.location.href);
  const wasi = new WASI(
    [],
    [],
    [
      new OpenFile(new WasiFile([])), // stdin
      ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
      ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
    ]
  );
  // @ts-expect-error 2307
  const factory = (await import("/jsandbox/jsandbox_bg.js")).default;
  const jsandbox = factory();
  const { instance } = await WebAssembly.instantiateStreaming(fetch(path), {
    "./jsandbox_bg.js": jsandbox,
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  jsandbox.__wbg_set_wasm(instance.exports);
  // @ts-expect-error 2739
  wasi.start({ exports: instance.exports });
  const result = jsandbox.run_module(code, JSON.stringify(inputs));
  return JSON.parse(result);
}
