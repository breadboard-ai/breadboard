/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "node:fs";
import {
  ConsoleStdout,
  File as WasiFile,
  OpenFile,
  WASI,
} from "@bjorn3/browser_wasi_shim";
import factory from "../target/wasm-bindgen/jsandbox_bg.js";

const path = new URL(
  "../target/wasm-bindgen/jsandbox_bg.wasm",
  import.meta.url
);
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
const wasmBuffer = fs.readFileSync(decodeURI(path.pathname));
const { instance } = await WebAssembly.instantiate(wasmBuffer, {
  "./jsandbox_bg.js": jsandbox,
  wasi_snapshot_preview1: wasi.wasiImport,
});
jsandbox.__wbg_set_wasm(instance.exports);
wasi.start({ exports: instance.exports });
const result = jsandbox.run_module(
  `
      export default function(inputs) {
        console.log("TEST");
        return {
          inputs
        };
      }
    `,
  JSON.stringify({
    args: "ARGS ARE HERE",
  })
);
console.log({ result: JSON.parse(result) });
