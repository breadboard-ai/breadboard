/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { fetch, Capabilities };

type Values = Record<string, unknown>;

type Capability = (inputs: Values) => Promise<Values>;

class Capabilities {
  #capabilities = new Map<string, Capability>();

  static #instance: Capabilities = new Capabilities();

  constructor() {}

  get(name: string) {
    return this.#capabilities.get(name);
  }

  async invoke(name: string, inputs: Values) {
    const c = this.get(name);
    if (!c) {
      throw new Error(`Capability "${name}" is not avaialble.`);
    }
    return c(inputs);
  }

  install(capabilities: [string, Capability][]) {
    this.#capabilities = new Map(capabilities);
  }

  static instance() {
    return this.#instance;
  }
}

async function fetch(inputs: Values) {
  return Capabilities.instance().invoke("fetch", inputs);
}
