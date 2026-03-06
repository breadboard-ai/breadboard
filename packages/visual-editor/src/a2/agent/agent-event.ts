/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent, EditSpec, ConsentType } from "@breadboard-ai/types";
import type { StatusUpdateCallbackOptions } from "./function-definition.js";
import type { GeminiBody, UsageMetadata } from "../a2/gemini.js";
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
  AgentEventMap,
  AgentEventType,
  Payload,
  StreamRunAgentResponse,
  SuspendEvent,
  AgentInputResponse,
  TransformDescriptor,
  UpdateNodeDescriptor,
  LayoutGraphDescriptor,
  StartPayload,
  ThoughtPayload,
  FunctionCallPayload,
  FunctionCallUpdatePayload,
  FunctionResultPayload,
  ContentPayload,
  TurnCompletePayload,
  SendRequestPayload,
  WaitForInputPayload,
  WaitForChoicePayload,
  ReadGraphPayload,
  InspectNodePayload,
  ApplyEditsPayload,
  QueryConsentPayload,
  GraphEditPayload,
  CompletePayload,
  ErrorPayload,
  FinishPayload,
  SubagentAddJsonPayload,
  SubagentErrorPayload,
  SubagentFinishPayload,
  UsageMetadataPayload,
};

// ---------------------------------------------------------------------------
// Payload types (the data inside each oneof variant — no `type` field)
// ---------------------------------------------------------------------------

type StartPayload = {
  objective: LLMContent;
};

type ThoughtPayload = {
  text: string;
};

type FunctionCallPayload = {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  icon?: string;
  title?: string;
};

type FunctionCallUpdatePayload = {
  callId: string;
  status: string | null;
  opts?: StatusUpdateCallbackOptions;
};

type FunctionResultPayload = {
  callId: string;
  content: LLMContent;
};

type ContentPayload = {
  content: LLMContent;
};

type TurnCompletePayload = Record<string, never>;

type SendRequestPayload = {
  model: string;
  body: GeminiBody;
};

type WaitForInputPayload = {
  requestId: string;
  prompt: LLMContent;
  inputType: string;
  skipLabel?: string;
  interactionId?: string;
};

type WaitForChoicePayload = {
  requestId: string;
  prompt: LLMContent;
  choices: { id: string; content: LLMContent }[];
  selectionMode: ChatChoiceSelectionMode;
  layout?: ChatChoiceLayout;
  noneOfTheAboveLabel?: string;
  interactionId?: string;
};

/**
 * Suspend: server needs the current graph structure.
 * Client reads `editor.raw()` and responds with `GraphDescriptor`.
 */
type ReadGraphPayload = {
  requestId: string;
  interactionId?: string;
};

/**
 * Suspend: server needs to inspect a specific node.
 * Client reads `editor.inspect("").nodeById(id)` and responds with
 * the node descriptor and metadata.
 */
type InspectNodePayload = {
  requestId: string;
  nodeId: string;
  interactionId?: string;
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
type ApplyEditsPayload = {
  requestId: string;
  label: string;
  interactionId?: string;
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
type QueryConsentPayload = {
  requestId: string;
  consentType: ConsentType;
  scope: Record<string, unknown>;
  graphUrl: string;
  interactionId?: string;
};

/**
 * A graph edit event carries serializable edit specs rather than the
 * `EditTransform` interface (which has an `apply` method). The consumer
 * wraps them in a transform and applies them to the graph.
 */
type GraphEditPayload = {
  edits: EditSpec[];
  label: string;
};

type CompletePayload = {
  result: AgentResult;
};

type ErrorPayload = {
  message: string;
};

type FinishPayload = Record<string, never>;

/**
 * Progress events emitted by sub-processes (image/video/audio/music gen)
 * running inside a function call. Scoped to a `callId` so the consumer
 * can dispatch to the correct work item.
 */
type SubagentAddJsonPayload = {
  callId: string;
  title: string;
  data: unknown;
  icon?: string;
};

type SubagentErrorPayload = {
  callId: string;
  error: { $error: string; metadata?: ErrorMetadata };
};

type SubagentFinishPayload = {
  callId: string;
};

type UsageMetadataPayload = {
  metadata: UsageMetadata;
};

// ---------------------------------------------------------------------------
// Wire format: proto-style oneof union.
//
// Each variant is a single-key object whose key names the event type
// and whose value is the payload. Example:
//   {"thought": {"text": "Thinking..."}}
//
// The `AgentEventType` union extracts all valid keys. The `Payload<T>`
// utility maps a key to its payload type.
// ---------------------------------------------------------------------------

/**
 * A map from event type name to its payload type.
 * Used by `AgentEvent`, `AgentEventType`, and `Payload<T>`.
 */
type AgentEventMap = {
  start: StartPayload;
  thought: ThoughtPayload;
  functionCall: FunctionCallPayload;
  functionCallUpdate: FunctionCallUpdatePayload;
  functionResult: FunctionResultPayload;
  content: ContentPayload;
  turnComplete: TurnCompletePayload;
  sendRequest: SendRequestPayload;
  waitForInput: WaitForInputPayload;
  waitForChoice: WaitForChoicePayload;
  readGraph: ReadGraphPayload;
  inspectNode: InspectNodePayload;
  applyEdits: ApplyEditsPayload;
  queryConsent: QueryConsentPayload;
  graphEdit: GraphEditPayload;
  complete: CompletePayload;
  error: ErrorPayload;
  finish: FinishPayload;
  subagentAddJson: SubagentAddJsonPayload;
  subagentError: SubagentErrorPayload;
  subagentFinish: SubagentFinishPayload;
  usageMetadata: UsageMetadataPayload;
};

/**
 * All valid event type names (the oneof key).
 */
type AgentEventType = keyof AgentEventMap;

/**
 * Extract the payload type for a given event type name.
 */
type Payload<T extends AgentEventType> = AgentEventMap[T];

/**
 * The proto-style oneof discriminated union.
 *
 * Each member is a single-key object: `{ eventType: payload }`.
 * On the wire (SSE `data:` line), this is exactly what the backend emits.
 */
type AgentEvent = {
  [K in AgentEventType]: { [P in K]: AgentEventMap[K] };
}[AgentEventType];

/**
 * The full SSE `data:` line envelope from `StreamRunAgentResponse`.
 *
 * Wraps an `AgentEvent` (the `oneof event`) with optional top-level fields
 * that the proto places alongside the event:
 * - `snapshotId`: sandbox snapshot captured after each agent action.
 */
type StreamRunAgentResponse = AgentEvent & {
  snapshotId?: string;
};

/**
 * All event types that suspend the loop and wait for a client response.
 * Each payload has a `requestId` for correlation.
 *
 * When received from a remote backend (SSE), the payloads also carry an
 * `interactionId` for the reconnect protocol — the client POSTs it
 * back to resume the stream.
 */
type SuspendEvent =
  | { waitForInput: WaitForInputPayload }
  | { waitForChoice: WaitForChoicePayload }
  | { readGraph: ReadGraphPayload }
  | { inspectNode: InspectNodePayload }
  | { applyEdits: ApplyEditsPayload }
  | { queryConsent: QueryConsentPayload };

/**
 * The set of event type names that are suspend events.
 */
const SUSPEND_TYPES = new Set<AgentEventType>([
  "waitForInput",
  "waitForChoice",
  "readGraph",
  "inspectNode",
  "applyEdits",
  "queryConsent",
]);

/**
 * Extract the event type name (the single key) from an `AgentEvent`.
 */
function eventType(event: AgentEvent): AgentEventType {
  return Object.keys(event)[0] as AgentEventType;
}

/**
 * Extract the payload object from an `AgentEvent`.
 */
function eventPayload(event: AgentEvent): AgentEventMap[AgentEventType] {
  const key = eventType(event);
  return (event as Record<string, unknown>)[
    key
  ] as AgentEventMap[AgentEventType];
}

export { SUSPEND_TYPES, eventType, eventPayload };

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
