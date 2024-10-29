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

import factory from "./factory.js";

export { RunModuleManager };

class RunModuleManager {
  constructor(public readonly runtimeUrl: URL) {}

  async runModule(
    method: "default" | "describe",
    name: string,
    modules: Record<string, string>,
    code: string,
    inputs: Record<string, unknown>
  ) {
    const wasi = new WASI(
      [],
      [],
      [
        new OpenFile(new WasiFile([])), // stdin
        ConsoleStdout.lineBuffered((msg) =>
          console.log(`[WASI stdout] ${msg}`)
        ),
        ConsoleStdout.lineBuffered((msg) =>
          console.warn(`[WASI stderr] ${msg}`)
        ),
      ]
    );
    const jsandbox = factory();
    const { instance } = await WebAssembly.instantiateStreaming(
      fetch(this.runtimeUrl),
      {
        "./jsandbox_bg.js": jsandbox,
        wasi_snapshot_preview1: wasi.wasiImport,
      }
    );
    jsandbox.__wbg_set_wasm(instance.exports);
    // @ts-expect-error 2739
    wasi.start({ exports: instance.exports });
    const result = await jsandbox.run_module(
      method,
      name,
      modules,
      code,
      JSON.stringify(inputs)
    );
    return JSON.parse(result);
  }
}
