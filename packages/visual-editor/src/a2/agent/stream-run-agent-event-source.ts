/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentEvent } from "./agent-event.js";
import { SUSPEND_TYPES, eventType, eventPayload } from "./agent-event.js";
import type { AgentEventConsumer } from "./agent-event-consumer.js";
import { iteratorFromStream } from "@breadboard-ai/utils";

export { StreamRunAgentEventSource };

/**
 * Client-side SSE adapter that reads an agent event stream using the
 * legacy `streamRunAgent` endpoint.
 *
 * Uses the Resumable Stream Protocol: a single POST request with
 * the run config in the body, returning an SSE stream.
 *
 * **Reconnect model:** When a suspend event arrives, the stream closes.
 * The client awaits the consumer handler (which collects user input),
 * then POSTs again with `{interactionId, response}` to resume on a
 * new stream. This repeats until the run completes.
 *
 * This is the legacy protocol — the sessions-based `SSEAgentEventSource`
 * is the newer replacement, gated behind `enableSessionsBackend`.
 */
class StreamRunAgentEventSource {
  constructor(
    private readonly baseUrl: string,
    private readonly config: Record<string, unknown>,
    private readonly consumer: AgentEventConsumer,
    private readonly fetchWithCreds: typeof fetch,
    private readonly signal?: AbortSignal
  ) {
    console.log("[SSE] Created StreamRunAgentEventSource", { baseUrl, config });
  }

  /**
   * Open the SSE connection and start dispatching events.
   *
   * Returns a Promise that resolves when the run completes (complete/error
   * event) and rejects on unrecoverable errors.
   */
  async connect(): Promise<void> {
    // First connection: wrap config under "start" (proto oneof).
    let body: Record<string, unknown> = { start: this.config };

    // Reconnect loop: each iteration is one POST → stream cycle.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await this.#streamOnce(body);

      if (result.done) {
        return;
      }

      // Suspend: POST again with interaction ID + user response.
      body = {
        resume: {
          interactionId: result.interactionId,
          response: result.response,
        },
      };
    }
  }

  /**
   * No-op for the legacy protocol — `streamRunAgent` has no server-side
   * cancel endpoint. The abort signal on the fetch handles teardown.
   */
  async cancel(): Promise<void> {
    // streamRunAgent has no cancel endpoint.
  }

  /**
   * Run a single POST → stream cycle.
   */
  async #streamOnce(
    body: Record<string, unknown>
  ): Promise<
    { done: true } | { done: false; interactionId: string; response: unknown }
  > {
    const url = `${this.baseUrl}/v1beta1/streamRunAgent?alt=sse`;
    console.log("[SSE] Connecting:", url, body);

    const response = await this.fetchWithCreds(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      const type = eventType(event);
      console.log("[SSE] Event:", type, event);

      if (SUSPEND_TYPES.has(type)) {
        const payload = eventPayload(event) as { interactionId: string };
        const userResponse = await this.consumer.handle(event);
        console.log("[SSE] Suspend resolved, reconnecting:", type);
        return {
          done: false,
          interactionId: payload.interactionId,
          response: userResponse,
        };
      }

      // Fire-and-forget: dispatch and continue.
      this.consumer.handle(event);

      if (type === "complete" || type === "error") {
        return { done: true };
      }
    }

    // Stream ended without complete/error — treat as done.
    console.log("[SSE] Stream ended normally");
    return { done: true };
  }
}
