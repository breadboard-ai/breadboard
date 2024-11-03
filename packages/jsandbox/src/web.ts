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
  UUID,
} from "./types.js";

export { WebModuleManager };

class WebModuleManager implements ModuleManager {
  #sandbox: Promise<ReturnType<typeof factory>>;

  constructor(public readonly runtimeUrl: URL) {
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

  invoke(
    invocationId: UUID,
    modules: ModuleSpec,
    name: string,
    inputs: InvokeInputs
  ): Promise<InvokeOutputs> {
    return this.#run(invocationId, "default", modules, name, inputs);
  }

  describe(
    invocationId: UUID,
    modules: ModuleSpec,
    name: string,
    inputs: DescriberInputs
  ): Promise<DescriberOutputs> {
    return this.#run(invocationId, "describe", modules, name, inputs);
  }

  async #run(
    invocationId: UUID,
    method: "default" | "describe",
    modules: ModuleSpec,
    name: string,
    inputs: InvokeInputs
  ) {
    const sandbox = await this.#sandbox;
    const code = modules[name];
    if (!code) {
      return { $error: `Unable to find module "${name}"` };
    }

    const result = await sandbox.run_module(
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
