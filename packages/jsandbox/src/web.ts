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
  #sandbox: Promise<ReturnType<typeof factory>>;

  constructor(
    public readonly runtimeUrl: URL,
    public readonly modules: ModuleSpec
  ) {
    this.#sandbox = this.#start();
  }

  async #start() {
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
    return jsandbox;
  }

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
    const sandbox = await this.#sandbox;
    const code = this.modules[name];
    if (!code) {
      return { $error: `Unable to find module "${name}"` };
    }

    const label = `⏱️ Quick JS: ${name}`;
    console.time(label);
    const result = await sandbox.run_module(
      method,
      name,
      this.modules,
      code,
      JSON.stringify(inputs)
    );
    console.timeEnd(label);
    return JSON.parse(result);
  }
}
