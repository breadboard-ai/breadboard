/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AgentEvent,
  AgentEventMap,
  AgentEventType,
  Payload,
  SuspendEvent,
} from "./agent-event.js";
import { eventType, eventPayload } from "./agent-event.js";
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
  /** Handler signature after type erasure — operates on the full payload union. */
  readonly #handlers = new Map<
    AgentEventType,
    (payload: AgentEventMap[AgentEventType]) => void | Promise<unknown>
  >();

  /**
   * Register a handler for a specific event type.
   * Suspend-event handlers (waitForInput, waitForChoice) must return
   * a Promise that resolves with the user's response.
   *
   * The handler receives the narrow `Payload<T>`, but the internal map
   * stores it under the broader payload union. This cast is sound because
   * `handle()` always matches the key to the correct payload type at
   * runtime — the Map simply can't express the per-key relationship.
   */
  on<T extends AgentEventType>(
    type: T,
    handler: (payload: Payload<T>) => void | Promise<unknown>
  ): this {
    this.#handlers.set(
      type,
      handler as (
        payload: AgentEventMap[AgentEventType]
      ) => void | Promise<unknown>
    );
    return this;
  }

  /**
   * Dispatch an event to its registered handler.
   *
   * Extracts the oneof key and passes the payload to the handler.
   * Returns a Promise for suspend events, undefined otherwise.
   */
  handle(event: AgentEvent): void | Promise<unknown> {
    const type = eventType(event);
    const payload = eventPayload(event);
    const handler = this.#handlers.get(type);
    if (handler) {
      return handler(payload);
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

  async suspend<T>(event: SuspendEvent): Promise<T> {
    return this.consumer.handle(event as AgentEvent) as Promise<T>;
  }
}
