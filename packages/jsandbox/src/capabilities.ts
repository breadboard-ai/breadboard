/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { fetch, secrets, invoke, Capabilities };

type Values = Record<string, unknown>;

type Capability = (
  invocationId: number,
  inputs: Values
) => Promise<Values | void>;

class Capabilities {
  #capabilities = new Map<number, Map<string, Capability>>();

  static #instance: Capabilities = new Capabilities();

  constructor() {}

  get(invocationId: number, name: string): Capability | undefined {
    return this.#capabilities.get(invocationId)?.get(name);
  }

  async invoke(invocationId: number, name: string, inputs: string) {
    const c = this.get(invocationId, name);
    if (!c) {
      throw new Error(`Capability "${name}" is not avaialble.`);
    }
    return JSON.stringify(await c(invocationId, JSON.parse(inputs)));
  }

  install(invocationId: number, capabilities: Record<string, Capability>) {
    // if (!this.#capabilities.has(invocationId)) {
    //   throw new Error(
    //     `Invocation ID collision: "${invocationId}" capabilities were already installed.`
    //   );
    // }
    this.#capabilities.set(invocationId, new Map(Object.entries(capabilities)));
  }

  uninstall(invocationId: number) {
    this.#capabilities.delete(invocationId);
  }

  static instance() {
    return this.#instance;
  }
}

async function fetch(invocationId: number, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "fetch", inputs);
}

async function secrets(invocationId: number, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "secrets", inputs);
}

async function invoke(invocationId: number, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "invoke", inputs);
}
