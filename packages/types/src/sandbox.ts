/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, OutputValues } from "./graph-descriptor.js";

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

export type RunnableModuleTelemetry = {
  startModule(): Promise<void>;
  endModule(): Promise<void>;
  invocationPath(path: number): number[];
  startCapability(type: string, inputs: InputValues): Promise<number>;
  endCapability(
    type: string,
    path: number,
    inputs: InputValues,
    outputs: OutputValues
  ): Promise<void>;
};

export type Sandbox = {
  runModule(
    invocationId: string,
    method: "default" | "describe",
    modules: ModuleSpec,
    name: string,
    inputs: Record<string, unknown>
  ): Promise<InvokeOutputs | DescriberOutputs>;
};
