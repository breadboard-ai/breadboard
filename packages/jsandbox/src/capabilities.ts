/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues, UUID } from "@breadboard-ai/types";
import { Telemetry } from "./telemetry.js";
import { Capability, CapabilitySpec } from "./types.js";

export {
  fetch,
  secrets,
  invoke,
  output,
  describe,
  query,
  read,
  write,
  blob,
  Capabilities,
};

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
    const parsedInputs = JSON.parse(inputs);
    const isOutput = name === "output";
    const metadata = parsedInputs.$metadata;
    if (metadata && !isOutput) {
      delete parsedInputs.$metadata;
    }
    const path =
      (await installed.telemetry?.startCapability(
        name,
        parsedInputs,
        metadata
      )) || 0;
    let outputs;
    try {
      outputs = await capability(
        parsedInputs,
        installed.telemetry?.invocationPath(path) || []
      );
    } catch (e) {
      outputs = {
        $error: `Unable to invoke capability: ${(e as Error).message}`,
      };
    }
    await installed.telemetry?.endCapability(
      name,
      path,
      parsedInputs,
      outputs as OutputValues
    );
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

async function output(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "output", inputs);
}

async function describe(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "describe", inputs);
}

async function query(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "query", inputs);
}

async function read(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "read", inputs);
}

async function write(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "write", inputs);
}

async function blob(invocationId: UUID, inputs: string) {
  return Capabilities.instance().invoke(invocationId, "blob", inputs);
}
