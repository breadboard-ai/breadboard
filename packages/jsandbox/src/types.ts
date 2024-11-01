/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Values = Record<string, unknown>;
export type ModuleSpec = Record<string, string>;
export type ModuleMethod = "default" | "describe";

export type DescriberInputs = {
  inputs?: Values;
  inputSchema?: unknown;
  outputSchema?: unknown;
};
export type DescriberOutputs = { inputSchema: unknown; outputSchema: unknown };
export type InvokeInputs = Values;
export type InvokeOutputs = Values;

export type ModuleManager = {
  invoke(
    modules: ModuleSpec,
    name: string,
    inputs: InvokeInputs
  ): Promise<InvokeOutputs>;
  describe(
    modules: ModuleSpec,
    name: string,
    inputs: DescriberInputs
  ): Promise<DescriberOutputs>;
};
