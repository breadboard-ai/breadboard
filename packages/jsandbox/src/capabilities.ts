/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capability, UUID } from "./types.js";

export { fetch, secrets, invoke, Capabilities };

type Values = Record<string, unknown>;

class Capabilities {
  #capabilities = new Map<UUID, Map<string, Capability>>();

  static #instance: Capabilities = new Capabilities();

  constructor() {}

  get(invocationId: UUID, name: string): Capability | undefined {
    return this.#capabilities.get(invocationId)?.get(name);
  }

  async invoke(invocationId: UUID, name: string, inputs: string) {
    const c = this.get(invocationId, name);
    if (!c) {
      throw new Error(
        `Capability "${name}" is not avaialble for invocation "${invocationId}".`
      );
    }
    return JSON.stringify(await c(JSON.parse(inputs)));
  }

  install(invocationId: UUID, capabilities: Record<string, Capability>) {
    if (this.#capabilities.has(invocationId)) {
      throw new Error(
        `Invocation ID collision: "${invocationId}" capabilities were already installed.`
      );
    }
    this.#capabilities.set(invocationId, new Map(Object.entries(capabilities)));
  }

  uninstall(invocationId: UUID) {
    this.#capabilities.delete(invocationId);
  }

  static instance() {
    return this.#instance;
  }
}

async function fetch(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "fetch", inputs);
}

async function secrets(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "secrets", inputs);
}

async function invoke(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "invoke", inputs);
}
