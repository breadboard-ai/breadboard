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
import {
  DescriberInputs,
  DescriberOutputs,
  InvokeInputs,
  InvokeOutputs,
  ModuleManager,
  ModuleSpec,
} from "./types.js";

export { loadRuntime, NodeModuleManager };

async function loadRuntime(): Promise<Buffer> {
  const path = join(import.meta.dirname, "..", "..", "sandbox.wasm");
  return readFile(path);
}

class NodeModuleManager implements ModuleManager {
  constructor(public readonly wasm: Buffer) {}

  invoke(
    modules: ModuleSpec,
    name: string,
    inputs: InvokeInputs
  ): Promise<InvokeOutputs> {
    return this.#run("default", modules, name, inputs);
  }

  describe(
    modules: ModuleSpec,
    name: string,
    inputs: DescriberInputs
  ): Promise<DescriberOutputs> {
    return this.#run("describe", modules, name, inputs);
  }

  async #run(
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
      1,
      method,
      name,
      modules,
      code,
      JSON.stringify(inputs)
    );
    return JSON.parse(result);
  }
}
