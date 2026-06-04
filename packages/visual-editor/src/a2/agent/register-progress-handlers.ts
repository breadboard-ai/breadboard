/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Registers the standard set of agent event handlers on an
 * {@link AgentEventConsumer}. Extracted from `invokeRemoteAgent()`
 * so both the sessions-backend path and the Heartstone graph-runner
 * path can share the same handler wiring.
 *
 * Covers fire-and-forget progress handlers (start, finish, thought,
 * functionCall, etc.) and per-path callbacks for `complete`/`error`.
 */

import type { LLMContent } from "@breadboard-ai/types";
import type { AgentEventConsumer } from "./agent-event-consumer.js";
import type { ConsoleProgressManager } from "./console-progress-manager.js";
import type { ProgressReporter } from "./types.js";

export { registerProgressHandlers };
export type { ProgressCallbacks };

/**
 * Path-specific callbacks for events that are handled differently
 * depending on the caller (sessions-backend vs. Heartstone).
 */
interface ProgressCallbacks {
  /** Called when the agent emits a `complete` event with the result. */
  onComplete?: (result: { success: boolean; outcomes?: LLMContent }) => void;
  /** Called when the agent emits an `error` event. */
  onError?: (message: string) => void;
}

/**
 * Register the standard set of agent progress handlers on a consumer.
 *
 * This wires up all fire-and-forget agent event types to a
 * {@link ConsoleProgressManager}, which updates the console entry's
 * work items and the app screen in the UI.
 *
 * Used by:
 * - `invokeRemoteAgent()` in `main.ts` (sessions-backend path)
 * - `processEvent()` in `backend-run-action.ts` (Heartstone path)
 *
 * @param consumer The AgentEventConsumer to register handlers on.
 * @param progress The ConsoleProgressManager for UI updates.
 * @param callbacks Path-specific callbacks for complete/error.
 * @returns Maps for tracking function call IDs and reporters,
 *          needed if the caller wants to access them.
 */
function registerProgressHandlers(
  consumer: AgentEventConsumer,
  progress: ConsoleProgressManager,
  callbacks?: ProgressCallbacks
): {
  callIdMap: Map<string, string>;
  reporterMap: Map<string, ProgressReporter>;
} {
  const callIdMap = new Map<string, string>();
  const reporterMap = new Map<string, ProgressReporter>();

  consumer
    .on("start", (event) => {
      progress.startAgent(event.objective);
    })
    .on("finish", () => {
      progress.finish();
    })
    .on("complete", (event) => {
      callbacks?.onComplete?.(event.result);
    })
    .on("error", (event) => {
      callbacks?.onError?.(event.message);
    })
    .on("thought", (event) => {
      progress.thought(event.text);
    })
    .on("functionCall", (event) => {
      const { callId: progressCallId, reporter } = progress.functionCall(
        { functionCall: { name: event.name, args: event.args } },
        event.icon,
        event.title
      );
      callIdMap.set(event.callId, progressCallId);
      if (reporter) {
        reporterMap.set(event.callId, reporter);
      }
    })
    .on("functionCallUpdate", (event) => {
      const progressCallId = callIdMap.get(event.callId) ?? event.callId;
      progress.functionCallUpdate(progressCallId, event.status, event.opts);
    })
    .on("functionResult", (event) => {
      const progressCallId = callIdMap.get(event.callId) ?? event.callId;
      progress.functionResult(progressCallId, event.content);
      callIdMap.delete(event.callId);
      reporterMap.delete(event.callId);
    })
    .on("sendRequest", (event) => {
      progress.sendRequest(event.model, event.body);
    })
    .on("usageMetadata", (event) => {
      progress.usageMetadata(event.metadata);
    })
    .on("subagentAddJson", (event) => {
      reporterMap
        .get(event.callId)
        ?.addJson(event.title, event.data, event.icon);
    })
    .on("subagentAddContent", (event) => {
      reporterMap
        .get(event.callId)
        ?.addContent(event.title, event.content, event.icon);
    })
    .on("subagentError", (event) => {
      reporterMap.get(event.callId)?.addError(event.error);
    })
    .on("subagentFinish", (event) => {
      reporterMap.get(event.callId)?.finish();
    });

  return { callIdMap, reporterMap };
}
