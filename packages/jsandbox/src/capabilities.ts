/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { fetch, secrets, invoke, Capabilities };

type Values = Record<string, unknown>;

type Capability = (inputs: Values) => Promise<Values | void>;

class Capabilities {
  #capabilities = new Map<string, Capability>();

  static #instance: Capabilities = new Capabilities();

  constructor() {}

  get(name: string) {
    return this.#capabilities.get(name);
  }

  async invoke(name: string, inputs: string) {
    const c = this.get(name);
    if (!c) {
      throw new Error(`Capability "${name}" is not avaialble.`);
    }
    return JSON.stringify(await c(JSON.parse(inputs)));
  }

  install(capabilities: [string, Capability][]) {
    this.#capabilities = new Map(capabilities);
  }

  static instance() {
    return this.#instance;
  }
}

async function fetch(inputs: string) {
  return Capabilities.instance().invoke("fetch", inputs);
}

async function secrets(inputs: string) {
  return Capabilities.instance().invoke("secrets", inputs);
}

async function invoke(inputs: string) {
  return Capabilities.instance().invoke("invoke", inputs);
}
