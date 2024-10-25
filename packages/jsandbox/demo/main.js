/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConsoleStdout,
  File as WasiFile,
  OpenFile,
  WASI,
} from "https://esm.sh/@bjorn3/browser_wasi_shim";
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
const { instance } = await WebAssembly.instantiateStreaming(fetch(path), {
  "./jsandbox_bg.js": jsandbox,
  wasi_snapshot_preview1: wasi.wasiImport,
});
jsandbox.__wbg_set_wasm(instance.exports);
wasi.start({ exports: instance.exports });
const result = jsandbox.run_module(
  `
      export default function(inputs) {
        return \`HELLO \${JSON.stringify(inputs)}\`;
      }
    `,
  JSON.stringify({
    args: "ARGS ARE HERE",
  })
);
console.log({ result: JSON.parse(result) });
