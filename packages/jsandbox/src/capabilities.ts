/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Telemetry } from "./telemetry.js";
import { Capability, CapabilitySpec, UUID } from "./types.js";

export { fetch, secrets, invoke, Capabilities };

type Installed = {
  capabilities: Map<string, Capability>;
  telemetry?: Telemetry;
};

class Capabilities {
  #capabilities = new Map<UUID, Installed>();

  static #instance: Capabilities = new Capabilities();

  constructor() {}

  async invoke(invocationId: UUID, name: string, inputs: string) {
    const installed = this.#capabilities.get(invocationId);
    const capability = installed?.capabilities.get(name);
    if (!installed || !capability) {
      throw new Error(
        `Capability "${name}" is not avaialble for invocation "${invocationId}".`
      );
    }
    installed.telemetry?.startCapability();
    const outputs = await capability(JSON.parse(inputs));
    installed.telemetry?.endCapability();
    return JSON.stringify(outputs);
  }

  install(
    invocationId: UUID,
    capabilities: CapabilitySpec,
    telemetry?: Telemetry
  ) {
    if (this.#capabilities.has(invocationId)) {
      throw new Error(
        `Invocation ID collision: "${invocationId}" capabilities were already installed.`
      );
    }
    this.#capabilities.set(invocationId, {
      telemetry,
      capabilities: new Map(Object.entries(capabilities)),
    });
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
