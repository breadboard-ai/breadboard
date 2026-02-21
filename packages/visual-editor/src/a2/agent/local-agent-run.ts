/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AgentEventConsumer,
  LocalAgentEventBridge,
} from "./agent-event-consumer.js";
import type { AgentEventSink } from "./agent-event-sink.js";
import type { AgentRunHandle } from "./agent-service.js";

export { LocalAgentRun };

/**
 * In-process agent run implementation.
 *
 * Uses a `LocalAgentEventBridge` for direct, in-process communication
 * between the agent loop (sink) and the event consumer. This is the
 * default mode when the agent runs client-side.
 */
class LocalAgentRun implements AgentRunHandle {
  readonly events: AgentEventConsumer;
  readonly sink: AgentEventSink;

  readonly #abortController = new AbortController();

  constructor(
    readonly runId: string,
    readonly kind: string
  ) {
    this.events = new AgentEventConsumer();
    this.sink = new LocalAgentEventBridge(this.events);
  }

  abort(): void {
    this.#abortController.abort();
  }

  get aborted(): boolean {
    return this.#abortController.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.#abortController.signal;
  }
}
