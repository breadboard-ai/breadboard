/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConsoleStdout,
  OpenFile,
  WASI,
  File as WasiFile,
} from "@bjorn3/browser_wasi_shim";
import { type InputValues, type Kit } from "@google-labs/breadboard";

import factory from "./bindings.js";
import wasm from "/sandbox.wasm?url";

export { createKit };

function createKit(): Kit {
  return {
    url: import.meta.url,
    handlers: {
      runModule: async ({ $code: code, ...rest }) => {
        const result = await runModuleWithJsandbox(code as string, rest);
        return result;
      },
    },
  };
}

async function runModuleWithJsandbox(code: string, inputs: InputValues) {
  const path = new URL(wasm, window.location.href);
  const wasi = new WASI(
    [],
    [],
    [
      new OpenFile(new WasiFile([])), // stdin
      ConsoleStdout.lineBuffered((msg) => console.log(`[WASI stdout] ${msg}`)),
      ConsoleStdout.lineBuffered((msg) => console.warn(`[WASI stderr] ${msg}`)),
    ]
  );
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
