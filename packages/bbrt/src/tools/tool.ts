/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema7 } from "json-schema";
import type { Signal } from "signal-polyfill";
import type { ArtifactHandle } from "../artifacts/artifact-interface.js";
import type { PresentableError } from "../util/presentable-error.js";
import type { Result } from "../util/result.js";

export interface BBRTTool<I = unknown, O = unknown> {
  readonly metadata: ToolMetadata;
  api(): Promise<Result<ToolAPI>>;
  invoke(args: I): ToolInvocation<O>;
}

export interface ToolAPI {
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
}

export interface ToolMetadata {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export type ToolInvocationState<O = unknown> =
  | { status: "unstarted" }
  | { status: "running" }
  | {
      status: "success";
      value: InvokeResult<O>;
    }
  | { status: "error"; error: PresentableError };

export interface InvokeResult<O = unknown> {
  readonly output: O;
  readonly artifacts: ArtifactHandle[];
}

export interface ToolInvocation<O = unknown> {
  readonly state: Signal.State<ToolInvocationState<O>>;
  start(): void;
  render(): unknown;
  renderContent(): unknown;
}
