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
import { InvokeInputs, ModuleSpec, Sandbox } from "./types.js";
import { UUID } from "@breadboard-ai/types";

export { WebSandbox };

class WebSandbox implements Sandbox {
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

  async runModule(
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
