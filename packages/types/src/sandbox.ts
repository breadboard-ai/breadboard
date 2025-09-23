/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "./data.js";
import { GraphDescriptor } from "./graph-descriptor.js";
import { MutableGraph } from "./inspect.js";
import { UUID } from "./uuid.js";

export type Values = Record<string, unknown>;
export type ModuleSpec = Record<string, string>;
export type ModuleMethod = "default" | "describe";

export type DescriberInputs = {
  inputs?: Values;
  inputSchema?: unknown;
  outputSchema?: unknown;
  asType?: boolean;
};
export type DescriberOutputs = { inputSchema: unknown; outputSchema: unknown };
export type InvokeInputs = Values;
export type InvokeOutputs = Values;

export type Capability = (
  inputs: Values,
  path: number[]
) => Promise<Values | void>;

export type CapabilitySpec = {
  fetch?: Capability;
  invoke?: Capability;
  secrets?: Capability;
  input?: Capability;
  output?: Capability;
  describe?: Capability;
  query?: Capability;
  read?: Capability;
  write?: Capability;
  blob?: Capability;
};

export type RunnableModuleTelemetry = {
  startModule(): Promise<void>;
};

export type RunnableModule = {
  invoke(
    name: string,
    inputs: InvokeInputs,
    telemetry?: RunnableModuleTelemetry
  ): Promise<InvokeOutputs>;

  describe(name: string, inputs: DescriberInputs): Promise<DescriberOutputs>;
};

export type CapabilitiesManager = {
  createSpec(): CapabilitySpec;
};

export type RunnableModuleFactory = {
  createRunnableModule(
    mutable: MutableGraph,
    graph: GraphDescriptor,
    capabilities?: CapabilitiesManager
  ): Promise<Outcome<RunnableModule>>;
};

export type Sandbox = {
  runModule(
    invocationId: UUID,
    method: "default" | "describe",
    modules: ModuleSpec,
    name: string,
    inputs: Record<string, unknown>
  ): Promise<InvokeOutputs | DescriberOutputs>;
};
