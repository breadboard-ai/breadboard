/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent, EditSpec } from "@breadboard-ai/types";
import type { StatusUpdateCallbackOptions } from "./function-definition.js";
import type { GeminiBody } from "../a2/gemini.js";
import type { ErrorMetadata } from "../a2/utils.js";
import type {
  ChatChoiceLayout,
  ChatChoiceSelectionMode,
  ChatResponse,
  ChatChoicesResponse,
} from "./types.js";
import type { AgentResult } from "./loop.js";

export type {
  AgentEvent,
  SuspendEvent,
  AgentInputResponse,
  TransformDescriptor,
  UpdateNodeDescriptor,
  LayoutGraphDescriptor,
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
  ReadGraphEvent,
  InspectNodeEvent,
  ApplyEditsEvent,
  QueryConsentEvent,
  GraphEditEvent,
  CompleteEvent,
  ErrorEvent,
  FinishEvent,
  SubagentAddJsonEvent,
  SubagentErrorEvent,
  SubagentFinishEvent,
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
  args: Record<string, unknown>;
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
 * Suspend: server needs the current graph structure.
 * Client reads `editor.raw()` and responds with `GraphDescriptor`.
 */
type ReadGraphEvent = {
  type: "readGraph";
  requestId: string;
};

/**
 * Suspend: server needs to inspect a specific node.
 * Client reads `editor.inspect("").nodeById(id)` and responds with
 * the node descriptor and metadata.
 */
type InspectNodeEvent = {
  type: "inspectNode";
  requestId: string;
  nodeId: string;
};

/**
 * Suspend: server wants to apply graph modifications and get confirmation.
 * Client applies and responds with success/failure.
 *
 * Two modes:
 * - `edits`: raw `EditSpec[]` for simple edits (add node, remove node)
 * - `transform`: a serializable descriptor for complex transforms that need
 *   graph-aware context (e.g., `UpdateNode` reads inspector to compute diffs)
 *
 * Differs from fire-and-forget `graphEdit` — the server waits for confirmation
 * before continuing.
 */
type ApplyEditsEvent = {
  type: "applyEdits";
  requestId: string;
  label: string;
} & (
  | { edits: EditSpec[]; transform?: never }
  | { edits?: never; transform: TransformDescriptor }
);

/**
 * Serializable descriptors for graph transforms that cannot be
 * reduced to plain `EditSpec[]`. The client instantiates the
 * appropriate transform class and applies it.
 */
type TransformDescriptor = UpdateNodeDescriptor | LayoutGraphDescriptor;

type UpdateNodeDescriptor = {
  kind: "updateNode";
  nodeId: string;
  graphId: string;
  configuration: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  portsToAutowire: { path: string; title: string }[] | null;
};

type LayoutGraphDescriptor = {
  kind: "layoutGraph";
};

/**
 * Suspend: server needs user consent for an operation.
 * Client shows a consent dialog and responds with allow/deny.
 */
type QueryConsentEvent = {
  type: "queryConsent";
  requestId: string;
  consentType: string;
  scope: Record<string, unknown>;
  graphUrl: string;
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

/**
 * Progress events emitted by sub-processes (image/video/audio/music gen)
 * running inside a function call. Scoped to a `callId` so the consumer
 * can dispatch to the correct work item.
 */
type SubagentAddJsonEvent = {
  type: "subagentAddJson";
  callId: string;
  title: string;
  data: unknown;
  icon?: string;
};

type SubagentErrorEvent = {
  type: "subagentError";
  callId: string;
  error: { $error: string; metadata?: ErrorMetadata };
};

type SubagentFinishEvent = {
  type: "subagentFinish";
  callId: string;
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
  | ReadGraphEvent
  | InspectNodeEvent
  | ApplyEditsEvent
  | QueryConsentEvent
  | GraphEditEvent
  | CompleteEvent
  | ErrorEvent
  | FinishEvent
  | SubagentAddJsonEvent
  | SubagentErrorEvent
  | SubagentFinishEvent;

/**
 * All event types that suspend the loop and wait for a client response.
 * Each has a `requestId` for correlation.
 */
type SuspendEvent =
  | WaitForInputEvent
  | WaitForChoiceEvent
  | ReadGraphEvent
  | InspectNodeEvent
  | ApplyEditsEvent
  | QueryConsentEvent;

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
