/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema7 } from "json-schema";
import type { ArtifactHandle } from "../artifacts/artifact-interface.js";
import type { Result } from "../util/result.js";

export interface BBRTTool<I = unknown, O = unknown> {
  readonly metadata: BBRTToolMetadata;
  api(): Promise<Result<BBRTToolAPI>>;
  execute(args: I): {
    result: Promise<Result<{ data: O; artifacts?: ArtifactHandle[] }>>;
    render?: () => unknown;
  };
}

export interface BBRTToolMetadata {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface BBRTToolAPI {
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
}

export interface BBRTToolExecuteResult<O = unknown> {
  readonly output: O;
  readonly artifacts: ArtifactHandle[];
}
