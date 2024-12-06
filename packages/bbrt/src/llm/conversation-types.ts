/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";
import { SignalArray } from "signal-utils/array";
import type { BBRTTool, InvokeResult, ToolInvocation } from "../tools/tool.js";
import type { BufferedMultiplexStream } from "../util/buffered-multiplex-stream.js";
import type { PresentableError } from "../util/presentable-error.js";

export type BBRTTurn = BBRTUserTurn | BBRTModelTurn | BBRTErrorTurn;

export type BBRTUserTurn = BBRTUserTurnContent | BBRTUserTurnToolResponses;

export type BBRTTurnStatus =
  | "pending"
  | "streaming"
  | "using-tools"
  | "done"
  | "error";

export interface BBRTUserTurnContent {
  kind: "user-content";
  role: "user";
  status: Signal.State<BBRTTurnStatus>;
  content: string;
}

export interface BBRTUserTurnToolResponses {
  kind: "user-tool-responses";
  role: "user";
  status: Signal.State<BBRTTurnStatus>;
  responses: BBRTToolResponse[];
}

export interface BBRTModelTurn {
  kind: "model";
  role: "model";
  status: Signal.State<BBRTTurnStatus>;
  content: BufferedMultiplexStream<string>;
  toolCalls?: SignalArray<BBRTToolCall>;
  error?: PresentableError;
}

export interface BBRTErrorTurn {
  kind: "error";
  role: "user" | "model";
  status: Signal.State<BBRTTurnStatus>;
  error: PresentableError;
}

export interface BBRTToolCall {
  id: string;
  tool: BBRTTool;
  args: unknown;
  invocation: ToolInvocation;
}

export interface BBRTToolResponse {
  id: string;
  tool: BBRTTool;
  invocation: ToolInvocation;
  args: unknown;
  response: InvokeResult;
}
