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
import { readFile } from "fs/promises";
import { join } from "path";
import factory from "./factory.js";
import { ModuleSpec, Sandbox, UUID } from "./types.js";

export { loadRuntime, NodeSandbox };

async function loadRuntime(): Promise<Buffer> {
  const path = join(import.meta.dirname, "..", "..", "sandbox.wasm");
  return readFile(path);
}

class NodeSandbox implements Sandbox {
  constructor(public readonly wasm: Buffer) {}

  async runModule(
    invocationId: UUID,
    method: "default" | "describe",
    modules: ModuleSpec,
    name: string,
    inputs: Record<string, unknown>
  ) {
    const code = modules[name];
    if (!code) {
      return { $error: `Unable to find module "${name}"` };
    }
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
    const result = await jsandbox.run_module(
      invocationId,
      method,
      name,
      modules,
      code,
      JSON.stringify(inputs)
    );
    return JSON.parse(result);
  }
}
