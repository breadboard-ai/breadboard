/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentEvent, SuspendEvent } from "./agent-event.js";
import { AgentEventConsumer } from "./agent-event-consumer.js";
import { iteratorFromStream } from "@breadboard-ai/utils";

export { SSEAgentEventSource };

/** Set of event types that require a client response. */
const SUSPEND_TYPES = new Set<string>([
  "waitForInput",
  "waitForChoice",
  "readGraph",
  "inspectNode",
  "applyEdits",
  "queryConsent",
]);

/**
 * Client-side SSE adapter that reads an agent event stream from the
 * server and dispatches events to an `AgentEventConsumer`.
 *
 * Uses the same `fetch` + `iteratorFromStream` pattern as all other
 * streaming endpoints (e.g. `gemini.ts`).
 *
 * For fire-and-forget events, calls `consumer.handle(event)`.
 * For suspend events, calls `consumer.handle(event)`, awaits the
 * Promise (the UI handler resolves it with the user's response),
 * then POSTs the response to `POST /api/agent/{runId}/input`.
 */
class SSEAgentEventSource {
  constructor(
    private readonly baseUrl: string,
    private readonly runId: string,
    private readonly consumer: AgentEventConsumer,
    private readonly fetchWithCreds: typeof fetch,
    private readonly signal?: AbortSignal
  ) {}

  /**
   * Open the SSE connection and start dispatching events.
   *
   * Returns a Promise that resolves when the stream ends (finish event
   * or connection close) and rejects on unrecoverable errors.
   */
  async connect(): Promise<void> {
    const url = `${this.baseUrl}/api/agent/${this.runId}/events`;

    const response = await this.fetchWithCreds(url, { signal: this.signal });
    if (!response.ok) {
      throw new Error(
        `SSE connection failed: ${response.status} ${response.statusText}`
      );
    }
    if (!response.body) {
      throw new Error("SSE response has no body");
    }

    const events = iteratorFromStream<AgentEvent>(response.body);
    for await (const event of events) {
      await this.#dispatch(event);

      if (event.type === "finish" || event.type === "error") {
        break;
      }
    }
  }

  /**
   * Dispatch a single event. For suspend events, awaits the consumer's
   * handler Promise and POSTs the response to the server.
   */
  async #dispatch(event: AgentEvent): Promise<void> {
    if (SUSPEND_TYPES.has(event.type)) {
      const suspendEvent = event as SuspendEvent;
      const response = await this.consumer.handle(event);
      await this.#postInput(suspendEvent.requestId, response);
    } else {
      this.consumer.handle(event);
    }
  }

  /** POST a suspend response to the server's /input endpoint. */
  async #postInput(requestId: string, response: unknown): Promise<void> {
    const url = `${this.baseUrl}/api/agent/${this.runId}/input`;
    const res = await this.fetchWithCreds(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, response }),
      signal: this.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to POST /input: ${res.status} ${res.statusText}`);
    }
  }
}
