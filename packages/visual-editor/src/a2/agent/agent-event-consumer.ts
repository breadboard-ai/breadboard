/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentEvent } from "./agent-event.js";
import type { AgentEventSink } from "./agent-event-sink.js";

export { AgentEventConsumer, LocalAgentEventBridge };

/**
 * The consumer-side dispatcher for agent events.
 *
 * Receives events (today from an in-process bridge, tomorrow from an SSE
 * stream) and dispatches them to the appropriate handlers.
 *
 * Handlers are registered by event type. Each handler can optionally return
 * a Promise — used by suspend events (waitForInput, waitForChoice) to
 * signal when the user has responded.
 */
class AgentEventConsumer {
  readonly #handlers = new Map<
    AgentEvent["type"],
    (event: AgentEvent) => void | Promise<unknown>
  >();

  /**
   * Register a handler for a specific event type.
   * Suspend-event handlers (waitForInput, waitForChoice) must return
   * a Promise that resolves with the user's response.
   */
  on<T extends AgentEvent["type"]>(
    type: T,
    handler: (
      event: Extract<AgentEvent, { type: T }>
    ) => void | Promise<unknown>
  ): this {
    this.#handlers.set(
      type,
      handler as (event: AgentEvent) => void | Promise<unknown>
    );
    return this;
  }

  /**
   * Dispatch an event to its registered handler.
   * Returns a Promise for suspend events, undefined otherwise.
   */
  handle(event: AgentEvent): void | Promise<unknown> {
    const handler = this.#handlers.get(event.type);
    if (handler) {
      return handler(event);
    }
  }
}

/**
 * In-process bridge that connects an `AgentEventSink` (producer) to an
 * `AgentEventConsumer` (consumer) within the same process.
 *
 * For fire-and-forget events, calls `consumer.handle()` synchronously.
 * For suspend events, the consumer's `handle()` returns a Promise that
 * resolves when the user responds in the UI.
 *
 * When the server exists, this bridge is replaced by:
 * - Server: `SSEAgentEventSink` (writes to SSE stream)
 * - Client: `SSEAgentEventSource` (reads from SSE stream → consumer)
 */
class LocalAgentEventBridge implements AgentEventSink {
  constructor(private readonly consumer: AgentEventConsumer) {}

  emit(event: AgentEvent): void {
    this.consumer.handle(event);
  }

  async suspend<T>(event: AgentEvent & { requestId: string }): Promise<T> {
    return this.consumer.handle(event) as Promise<T>;
  }
}
