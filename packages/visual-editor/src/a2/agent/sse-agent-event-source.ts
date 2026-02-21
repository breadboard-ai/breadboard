/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentEvent } from "./agent-event.js";
import { AgentEventConsumer } from "./agent-event-consumer.js";
import { iteratorFromStream } from "@breadboard-ai/utils";

export { SSEAgentEventSource };

/**
 * Client-side SSE adapter that reads an agent event stream from the
 * server and dispatches events to an `AgentEventConsumer`.
 *
 * Uses the Resumable Stream Protocol: a single POST request with
 * the run config in the body, returning an SSE stream.
 *
 * Uses the same `fetch` + `iteratorFromStream` pattern as all other
 * streaming endpoints (e.g. `gemini.ts`).
 *
 * For fire-and-forget events, calls `consumer.handle(event)`.
 * For suspend events, calls `consumer.handle(event)` and awaits
 * the Promise (the UI handler resolves it with the user's response).
 * The response is sent to the server by POSTing again with the
 * interaction ID (Resumable Stream Protocol - Phase 4.5).
 */
class SSEAgentEventSource {
  constructor(
    private readonly baseUrl: string,
    private readonly config: Record<string, unknown>,
    private readonly consumer: AgentEventConsumer,
    private readonly fetchWithCreds: typeof fetch,
    private readonly signal?: AbortSignal
  ) {
    console.log("[SSE] Created SSEAgentEventSource", { baseUrl, config });
  }

  /**
   * Open the SSE connection and start dispatching events.
   *
   * Returns a Promise that resolves when the stream ends (finish event
   * or connection close) and rejects on unrecoverable errors.
   */
  async connect(): Promise<void> {
    const url = `${this.baseUrl}/api/agent/run`;
    console.log("[SSE] Connecting:", url, this.config);

    try {
      const response = await this.fetchWithCreds(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.config),
        signal: this.signal,
      });
      console.log("[SSE] Response:", response.status, response.statusText);

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
        console.log("[SSE] Event:", event.type, event);
        await this.#dispatch(event);

        if (event.type === "finish" || event.type === "error") {
          break;
        }
      }
      console.log("[SSE] Stream ended normally");
    } catch (err) {
      console.error("[SSE] Error:", err);
      throw err;
    }
  }

  /**
   * Dispatch a single event.
   *
   * Suspend events will be handled via the Resumable Stream Protocol
   * (Phase 4.5): the stream closes, and the client POSTs again with
   * the interaction ID to continue.
   */
  async #dispatch(event: AgentEvent): Promise<void> {
    this.consumer.handle(event);
  }
}
