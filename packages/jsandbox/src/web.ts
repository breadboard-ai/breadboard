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

    const inputString = JSON.stringify(inputs);
    console.debug(
      ...niceSize(`Run module: "${name}": input size`, inputString.length)
    );

    const result = await sandbox.run_module(
      invocationId,
      method,
      name,
      modules,
      code,
      inputString
    );
    return JSON.parse(result);
  }
}

function niceSize(prefix: string, n: number): string[] {
  if (!Number.isInteger(n)) {
    console.warn(
      "niceSize: Input number should be an integer. Proceeding with the given value."
    );
  }

  const k = 1024;
  const units = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
  const styles = [
    "color:darkgray",
    "color:blue",
    "color:red;font-weight:bold",
    "color:red;font-weight:bold",
    "color:red;font-weight:bold",
  ];

  if (n === 0) {
    return ["%c0", "color: lightgray", "Bytes"];
  }

  let i = 0;
  while (n >= k && i < units.length - 1) {
    n /= k;
    i++;
  }

  const formattedValue = parseFloat(n.toFixed(2));
  let unitString = units[i];
  const style = styles[i];

  if (n === 1) {
    unitString = "Byte";
  }

  return [`${prefix} %c${formattedValue}`, style, unitString];
}
