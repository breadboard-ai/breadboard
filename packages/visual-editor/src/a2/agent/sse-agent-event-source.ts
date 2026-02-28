/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentEvent } from "./agent-event.js";
import { SUSPEND_TYPES, eventType, eventPayload } from "./agent-event.js";
import type { AgentEventConsumer } from "./agent-event-consumer.js";
import { iteratorFromStream } from "@breadboard-ai/utils";

export { SSEAgentEventSource };

/**
 * Client-side SSE adapter that reads an agent event stream from the
 * server and dispatches events to an `AgentEventConsumer`.
 *
 * Uses the Resumable Stream Protocol: a single POST request with
 * the run config in the body, returning an SSE stream.
 *
 * **Reconnect model:** When a suspend event arrives, the stream closes.
 * The client awaits the consumer handler (which collects user input),
 * then POSTs again with `{interactionId, response}` to resume on a
 * new stream. This repeats until the run completes.
 *
 * Suspends can last seconds, hours, or days — the stream cannot stay
 * open that long.
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
   * Returns a Promise that resolves when the run completes (complete/error
   * event) and rejects on unrecoverable errors.
   *
   * If the stream suspends, this method handles the reconnect loop
   * internally: it awaits the user's response, POSTs again with
   * `{interactionId, response}`, and continues dispatching from the
   * new stream.
   */
  async connect(): Promise<void> {
    // First connection: wrap config under "start" (proto oneof).
    let body: Record<string, unknown> = { start: this.config };

    // Reconnect loop: each iteration is one POST → stream cycle.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await this.#streamOnce(body);

      if (result.done) {
        // Stream completed normally (complete or error event).
        return;
      }

      // Stream ended because of a suspend event.
      // The handler has already been called and the user has responded.
      // POST again with the interaction ID and response to continue.
      body = {
        resume: {
          interactionId: result.interactionId,
          response: result.response,
        },
      };
    }
  }

  /**
   * Run a single POST → stream cycle.
   *
   * Returns `{done: true}` if the stream completed, or
   * `{done: false, interactionId, response}` if a suspend event
   * triggered a reconnect.
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

    // The stream yields proto-style oneof objects — our AgentEvent type
    // matches the wire format directly, no transformation needed.
    const events = iteratorFromStream<AgentEvent>(response.body);
    for await (const event of events) {
      const type = eventType(event);
      console.log("[SSE] Event:", type, event);

      if (SUSPEND_TYPES.has(type)) {
        // Suspend: await the consumer handler to get the user's response.
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
