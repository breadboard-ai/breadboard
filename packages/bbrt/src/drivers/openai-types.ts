/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema7 } from "json-schema";

export interface OpenAIChatRequest {
  stream?: boolean;
  model: string;
  messages: OpenAIMessage[];
  tools?: Array<OpenAITool>;
  tool_choice?:
    | "none"
    | "auto"
    | "required"
    | { type: "function"; function: { name: string } };
}

export type OpenAIMessage =
  | OpenAISystemMessage
  | OpenAIUserMessage
  | OpenAIAssistantMessage
  | OpenAIToolMessage;

export interface OpenAISystemMessage {
  role: "system";
  name?: string;
  content: string | string[];
}

export interface OpenAIUserMessage {
  role: "user";
  name?: string;
  content: string | string[];
}

export interface OpenAIAssistantMessage {
  role: "assistant";
  // TODO(aomarks) Actually at least one of content/tool_calls is required.
  content?: string;
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAIToolMessage {
  role: "tool";
  content: string | string[];
  tool_call_id: string;
}

export type OpenAITool = {
  type: "function";
  function: OpenAIFunction;
};

export interface OpenAIFunction {
  description?: string;
  name: string;
  parameters?: JSONSchema7;
  strict?: boolean | null;
}

export interface OpenAIChunk {
  choices: OpenAIChoice[];
}

export interface OpenAIChoice {
  delta: OpenAIDelta;
  finish_reason: string | null;
}

export interface OpenAIDelta {
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAIToolCall {
  // TODO(aomarks) You get index coming in, but it probably shouldn't be there
  // going out?
  index: number;
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}
