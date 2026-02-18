/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AgentEvent,
  WaitForInputEvent,
  WaitForChoiceEvent,
} from "./agent-event.js";

export type { AgentEventSink };

/**
 * The producer-side interface for agent events.
 *
 * Today, a `LocalAgentEventBridge` implements this and forwards events
 * to an in-process `AgentEventConsumer`.
 *
 * Tomorrow, an `SSEAgentEventSink` writes events to an SSE response
 * stream and parks suspend requests in a pending-request map.
 */
interface AgentEventSink {
  /**
   * Fire-and-forget: emit a progress event (thought, function call, etc.).
   */
  emit(event: AgentEvent): void;

  /**
   * Suspend the loop and wait for a client response.
   *
   * The `requestId` inside the event correlates the eventual response
   * back to this pending request.
   *
   * Returns the client's reply — the concrete type depends on the event:
   *   - `waitForInput`  → resolves with `ChatResponse`
   *   - `waitForChoice` → resolves with `ChatChoicesResponse`
   */
  suspend<T>(event: WaitForInputEvent | WaitForChoiceEvent): Promise<T>;
}
