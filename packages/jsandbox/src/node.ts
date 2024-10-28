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
import { join } from "path";
import { readFile } from "fs/promises";

export { RunModuleManager, loadRuntime };

async function loadRuntime(): Promise<Buffer> {
  const path = join(import.meta.dirname, "..", "..", "sandbox.wasm");
  return readFile(path);
}

class RunModuleManager {
  constructor(public readonly wasm: Buffer) {}

  async runModule(code: string, inputs: Record<string, unknown>) {
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
    const { instance } = await WebAssembly.instantiate(this.wasm, {
      "./jsandbox_bg.js": jsandbox,
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    jsandbox.__wbg_set_wasm(instance.exports);
    // @ts-expect-error 2739
    wasi.start({ exports: instance.exports });
    const result = await jsandbox.run_module(code, JSON.stringify(inputs));
    return JSON.parse(result);
  }
}
