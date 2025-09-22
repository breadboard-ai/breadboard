/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UUID } from "@breadboard-ai/types";
import { Capabilities } from "./capabilities.js";
import { Telemetry } from "./telemetry.js";
import {
  CapabilitySpec,
  DescriberInputs,
  DescriberOutputs,
  InvokeInputs,
  InvokeOutputs,
  ModuleSpec,
  Sandbox,
} from "./types.js";
import { RunnableModule } from "@breadboard-ai/types/sandbox.js";

export { SandboxedModule };

class SandboxedModule implements RunnableModule {
  #timers: Map<UUID, number> = new Map();

  constructor(
    public readonly sandbox: Sandbox,
    public readonly capabilities: CapabilitySpec,
    public readonly modules: ModuleSpec
  ) {}

  async #run(
    method: "describe" | "default",
    name: string,
    inputs: DescriberInputs | InvokeInputs,
    telemetry?: Telemetry
  ) {
    const invocationId = crypto.randomUUID();
    const label = `${method === "describe" ? "Describe" : "Invoke"} module "${name}": uuid="${invocationId}"`;
    this.#timers.set(invocationId, globalThis.performance.now());
    Capabilities.instance().install(invocationId, this.capabilities, telemetry);
    await telemetry?.startModule();
    const outputs = await this.sandbox.runModule(
      invocationId,
      method,
      this.modules,
      name,
      inputs
    );
    await telemetry?.endModule();
    Capabilities.instance().uninstall(invocationId);
    const startTime = this.#timers.get(invocationId);
    if (startTime !== undefined) {
      const duration = globalThis.performance.now() - startTime;
      console.debug?.(`${label}: ${duration.toFixed(0)} ms`);
      this.#timers.delete(invocationId);
    } else {
      console.warn(`Unable to find timing for "${invocationId}"`);
    }
    return outputs;
  }

  async invoke(
    name: string,
    inputs: InvokeInputs,
    telemetry?: Telemetry
  ): Promise<InvokeOutputs> {
    return this.#run("default", name, inputs, telemetry);
  }

  describe(name: string, inputs: DescriberInputs): Promise<DescriberOutputs> {
    return this.#run("describe", name, inputs) as Promise<DescriberOutputs>;
  }
}
