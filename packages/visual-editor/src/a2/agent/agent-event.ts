/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent, EditSpec } from "@breadboard-ai/types";
import type { StatusUpdateCallbackOptions } from "./function-definition.js";
import type { GeminiBody } from "../a2/gemini.js";
import type {
  ChatChoiceLayout,
  ChatChoiceSelectionMode,
  ChatResponse,
  ChatChoicesResponse,
} from "./types.js";
import type { AgentResult } from "./loop.js";

export type {
  AgentEvent,
  AgentInputResponse,
  StartEvent,
  ThoughtEvent,
  FunctionCallEvent,
  FunctionCallUpdateEvent,
  FunctionResultEvent,
  ContentEvent,
  TurnCompleteEvent,
  SendRequestEvent,
  WaitForInputEvent,
  WaitForChoiceEvent,
  GraphEditEvent,
  CompleteEvent,
  ErrorEvent,
  FinishEvent,
};

type StartEvent = {
  type: "start";
  objective: LLMContent;
};

type ThoughtEvent = {
  type: "thought";
  text: string;
};

type FunctionCallEvent = {
  type: "functionCall";
  callId: string;
  name: string;
  icon?: string;
  title?: string;
};

type FunctionCallUpdateEvent = {
  type: "functionCallUpdate";
  callId: string;
  status: string | null;
  opts?: StatusUpdateCallbackOptions;
};

type FunctionResultEvent = {
  type: "functionResult";
  callId: string;
  content: LLMContent;
};

type ContentEvent = {
  type: "content";
  content: LLMContent;
};

type TurnCompleteEvent = {
  type: "turnComplete";
};

type SendRequestEvent = {
  type: "sendRequest";
  model: string;
  body: GeminiBody;
};

type WaitForInputEvent = {
  type: "waitForInput";
  requestId: string;
  prompt: LLMContent;
  inputType: string;
};

type WaitForChoiceEvent = {
  type: "waitForChoice";
  requestId: string;
  prompt: LLMContent;
  choices: { id: string; content: LLMContent }[];
  selectionMode: ChatChoiceSelectionMode;
  layout?: ChatChoiceLayout;
  noneOfTheAboveLabel?: string;
};

/**
 * A graph edit event carries serializable edit specs rather than the
 * `EditTransform` interface (which has an `apply` method). The consumer
 * wraps them in a transform and applies them to the graph.
 */
type GraphEditEvent = {
  type: "graphEdit";
  edits: EditSpec[];
  label: string;
};

type CompleteEvent = {
  type: "complete";
  result: AgentResult;
};

type ErrorEvent = {
  type: "error";
  message: string;
};

type FinishEvent = {
  type: "finish";
};

type AgentEvent =
  | StartEvent
  | ThoughtEvent
  | FunctionCallEvent
  | FunctionCallUpdateEvent
  | FunctionResultEvent
  | ContentEvent
  | TurnCompleteEvent
  | SendRequestEvent
  | WaitForInputEvent
  | WaitForChoiceEvent
  | GraphEditEvent
  | CompleteEvent
  | ErrorEvent
  | FinishEvent;

/**
 * The response the client sends back to resume a suspended request.
 * Tagged with the `requestId` from the corresponding suspend event.
 */
type AgentInputResponse = {
  requestId: string;
} & (
  | { type: "chatInput"; response: ChatResponse }
  | { type: "choiceInput"; response: ChatChoicesResponse }
);
