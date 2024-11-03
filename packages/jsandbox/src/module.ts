/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "./capabilities.js";
import {
  CapabilitySpec,
  DescriberInputs,
  DescriberOutputs,
  InvokeInputs,
  InvokeOutputs,
  ModuleSpec,
  Sandbox,
} from "./types.js";

export { Module };

class Module {
  constructor(
    public readonly sandbox: Sandbox,
    public readonly capabilities: CapabilitySpec,
    public readonly modules: ModuleSpec
  ) {}

  async #run(
    method: "describe" | "default",
    name: string,
    inputs: DescriberInputs | InvokeInputs
  ) {
    const invocationId = crypto.randomUUID();
    Capabilities.instance().install(invocationId, this.capabilities);
    const outputs = await this.sandbox.runModule(
      invocationId,
      method,
      this.modules,
      name,
      inputs
    );
    Capabilities.instance().uninstall(invocationId);
    return outputs;
  }

  async invoke(name: string, inputs: InvokeInputs): Promise<InvokeOutputs> {
    return this.#run("default", name, inputs);
  }

  describe(name: string, inputs: DescriberInputs): Promise<DescriberOutputs> {
    return this.#run("describe", name, inputs) as Promise<DescriberOutputs>;
  }
}
