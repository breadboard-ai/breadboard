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
import {
  DescriberInputs,
  DescriberOutputs,
  InvokeInputs,
  InvokeOutputs,
  ModuleManager,
  ModuleSpec,
} from "./types.js";

export { WebModuleManager };

class WebModuleManager implements ModuleManager {
  constructor(
    public readonly runtimeUrl: URL,
    public readonly modules: ModuleSpec
  ) {}

  invoke(name: string, inputs: InvokeInputs): Promise<InvokeOutputs> {
    return this.#run("default", name, inputs);
  }

  describe(name: string, inputs: DescriberInputs): Promise<DescriberOutputs> {
    return this.#run("describe", name, inputs);
  }

  async #run(
    method: "default" | "describe",
    name: string,
    inputs: InvokeInputs
  ) {
    const code = this.modules[name];
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
      this.modules,
      code,
      JSON.stringify(inputs)
    );
    return JSON.parse(result);
  }
}
