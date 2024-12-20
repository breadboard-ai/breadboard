/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import type { ArtifactHandle } from "../artifacts/artifact-interface.js";
import type { JsonSerializableObject } from "../util/json-serializable.js";
import type { PresentableError } from "../util/presentable-error.js";

/**
 * JSON-serializable data for a function call and its response.
 */
export interface FunctionCallState {
  callId: string;
  functionId: string;
  args: JsonSerializableObject;
  response: FunctionCallResponse;
}

export type FunctionCallResponse =
  | { status: "unstarted" }
  | { status: "executing" }
  | {
      status: "success";
      result: JsonSerializableObject;
      artifacts: ArtifactHandle[];
    }
  | { status: "error"; error: PresentableError };

/**
 * Wrapper around {@link FunctionCallState} which provides reactivity
 * via proposed TC39 signals (https://github.com/tc39/proposal-signals).
 */
export class ReactiveFunctionCallState implements FunctionCallState {
  readonly callId: string;
  readonly functionId: string;
  readonly args: JsonSerializableObject;
  @signal accessor render: (() => unknown) | undefined = undefined;
  @signal accessor response: FunctionCallResponse;

  constructor({ callId, functionId, args, response }: FunctionCallState) {
    this.callId = callId;
    this.functionId = functionId;
    this.args = args;
    this.response = response;
  }

  get data(): FunctionCallState {
    return {
      callId: this.callId,
      functionId: this.functionId,
      args: this.args,
      response: this.response,
    };
  }
}
