/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentEvent } from "./agent-event.js";
import { SUSPEND_TYPES, eventType } from "./agent-event.js";
import type { AgentEventConsumer } from "./agent-event-consumer.js";
import { iteratorFromStream } from "@breadboard-ai/utils";

export { SSEAgentEventSource };

/**
 * Client-side adapter that reads an agent event stream from session
 * endpoints and dispatches events to an `AgentEventConsumer`.
 *
 * Uses the Session Protocol:
 * 1. `POST /sessions/new` — create session, get `sessionId`
 * 2. `GET /sessions/{id}` — SSE stream of events
 * 3. `POST /sessions/{id}/resume` — inject response on suspend
 *
 * On suspend, the SSE stream closes. The client awaits the consumer
 * handler (which collects user input), POSTs the resume, then
 * reconnects to the SSE stream with `?after=N` to pick up new events.
 */
class SSEAgentEventSource {
  /** Session ID, set after the first `POST /sessions/new`. */
  #sessionId: string | null = null;

  /** Cursor: index of the last received event (for reconnection). */
  #eventCursor = -1;

  constructor(
    private readonly baseUrl: string,
    private readonly config: Record<string, unknown>,
    private readonly consumer: AgentEventConsumer,
    private readonly fetchWithCreds: typeof fetch,
    private readonly signal?: AbortSignal
  ) {
    console.log("[SSE] Created SSEAgentEventSource", { baseUrl, config });
  }

  /** The session ID, available after `connect()` starts. */
  get sessionId(): string | null {
    return this.#sessionId;
  }

  /**
   * Open the session and start dispatching events.
   *
   * Creates a session, connects to the SSE stream, and dispatches
   * events. On suspend, collects the user response, POSTs the resume,
   * and reconnects to the stream. Repeats until the run completes.
   */
  async connect(): Promise<void> {
    // Step 1: Create session.
    this.#sessionId = await this.#createSession();
    console.log("[SSE] Session created:", this.#sessionId);

    // Step 2: Stream events (with reconnect on suspend).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await this.#streamEvents();

      if (result.done) {
        return;
      }

      // Suspend: collect user response, POST resume, reconnect.
      console.log("[SSE] Suspend resolved, resuming:", result.type);
      await this.#resume(result.response);
    }
  }

  /**
   * Cancel the session on the server.
   *
   * Called by `SSEAgentRun.abort()` to stop the background task and
   * prevent further inference costs.
   */
  async cancel(): Promise<void> {
    if (!this.#sessionId) return;
    const url = `${this.baseUrl}/v1beta1/sessions/${this.#sessionId}:cancel`;
    try {
      await this.fetchWithCreds(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Best-effort — the abort signal may have already killed the fetch.
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** POST /sessions/new → { sessionId } */
  async #createSession(): Promise<string> {
    const url = `${this.baseUrl}/v1beta1/sessions/new`;
    console.log("[SSE] Creating session:", url);

    const response = await this.fetchWithCreds(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.config),
      signal: this.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Session creation failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { sessionId: string };
    return data.sessionId;
  }

  /**
   * GET /sessions/{id}?after=N → SSE stream.
   *
   * Dispatches events to the consumer. Returns when the stream ends:
   * - `{done: true}` if the run completed (complete/error/stream end)
   * - `{done: false, type, response}` if a suspend event triggered
   */
  async #streamEvents(): Promise<
    { done: true } | { done: false; type: string; response: unknown }
  > {
    const after = this.#eventCursor;
    const url =
      after >= 0
        ? `${this.baseUrl}/v1beta1/sessions/${this.#sessionId}?after=${after}`
        : `${this.baseUrl}/v1beta1/sessions/${this.#sessionId}`;
    console.log("[SSE] Streaming:", url);

    const response = await this.fetchWithCreds(url, {
      signal: this.signal,
    });

    if (!response.ok) {
      throw new Error(
        `SSE connection failed: ${response.status} ${response.statusText}`
      );
    }
    if (!response.body) {
      throw new Error("SSE response has no body");
    }

    const events = iteratorFromStream<AgentEvent | SessionEnvelope>(
      response.body
    );
    for await (const event of events) {
      // Skip session protocol envelope events.
      if (isSessionEnvelope(event)) {
        continue;
      }

      // Track cursor: each event increments the cursor.
      this.#eventCursor++;

      const type = eventType(event as AgentEvent);
      console.log("[SSE] Event:", type, event);

      if (SUSPEND_TYPES.has(type)) {
        const userResponse = await this.consumer.handle(event as AgentEvent);
        return { done: false, type, response: userResponse };
      }

      // Fire-and-forget: dispatch and continue.
      this.consumer.handle(event as AgentEvent);

      if (type === "complete" || type === "error") {
        return { done: true };
      }
    }

    // Stream ended without complete/error — treat as done.
    console.log("[SSE] Stream ended normally");
    return { done: true };
  }

  /** POST /sessions/{id}/resume → { ok } */
  async #resume(response: unknown): Promise<void> {
    const url = `${this.baseUrl}/v1beta1/sessions/${this.#sessionId}/resume`;
    console.log("[SSE] Resuming:", url);

    const res = await this.fetchWithCreds(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
      signal: this.signal,
    });

    if (!res.ok) {
      throw new Error(
        `Resume failed: ${res.status} ${res.statusText}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Session envelope detection
// ---------------------------------------------------------------------------

/** Session protocol wrapper events (start, done). */
type SessionEnvelope = { sessionId?: string };

/**
 * Detect session protocol envelope events that should be skipped.
 * These are `{sessionId: "..."}` (start) and `{}` (done).
 */
function isSessionEnvelope(event: unknown): event is SessionEnvelope {
  if (typeof event !== "object" || event === null) return false;
  const keys = Object.keys(event);
  // Empty object = "done" envelope.
  if (keys.length === 0) return true;
  // Single "sessionId" key = "start" envelope.
  if (keys.length === 1 && keys[0] === "sessionId") return true;
  return false;
}
