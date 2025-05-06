/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

export { SandboxedModule };

class SandboxedModule {
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
    console.time(label);
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
    console.timeEnd(label);
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
