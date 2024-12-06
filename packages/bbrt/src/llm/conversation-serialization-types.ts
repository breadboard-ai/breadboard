/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InvokeResult, ToolInvocationState } from "../tools/tool.js";

export type SerializableBBRTTurn =
  | SerializableBBRTUserTurn
  | SerializableBBRTModelTurn
  | SerializableBBRTErrorTurn;

export type SerializableBBRTUserTurn =
  | SerializableBBRTUserTurnContent
  | SerializableBBRTUserTurnToolResponses;

export type SerializableBBRTTurnStatus =
  | "pending"
  | "streaming"
  | "using-tools"
  | "done"
  | "error";

export interface SerializableBBRTUserTurnContent {
  kind: "user-content";
  role: "user";
  status: SerializableBBRTTurnStatus;
  content: string;
}

export interface SerializableBBRTUserTurnToolResponses {
  kind: "user-tool-responses";
  role: "user";
  status: SerializableBBRTTurnStatus;
  responses: SerializableBBRTToolResponse[];
}

export interface SerializableBBRTModelTurn {
  kind: "model";
  role: "model";
  status: SerializableBBRTTurnStatus;
  content: string[];
  toolCalls?: Array<SerializableBBRTToolCall>;
  error?: unknown;
}

export interface SerializableBBRTErrorTurn {
  kind: "error";
  role: "user" | "model";
  status: SerializableBBRTTurnStatus;
  error: string;
}

export interface SerializableBBRTToolCall {
  id: string;
  toolId: string;
  args: unknown;
  invocationState: ToolInvocationState;
}

export interface SerializableBBRTToolResponse {
  id: string;
  toolId: string;
  invocationState: ToolInvocationState;
  args: unknown;
  response: InvokeResult;
}
