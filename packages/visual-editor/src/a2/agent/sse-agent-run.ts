/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentInputResponse } from "./agent-event.js";
import { AgentEventConsumer } from "./agent-event-consumer.js";
import type { AgentRunHandle } from "./agent-service.js";
import { SSEAgentEventSource } from "./sse-agent-event-source.js";

export { SSEAgentRun };

/**
 * Remote agent run backed by SSE.
 *
 * Instead of running the agent loop in-process, this connects to a
 * remote server via SSE. Events arrive over the stream and are
 * dispatched to the `AgentEventConsumer`. Suspend responses are
 * POSTed to the server's `/input` endpoint.
 *
 * The `sink` is not available — in remote mode, the agent loop runs
 * on the server, so there is no client-side sink.
 */
class SSEAgentRun implements AgentRunHandle {
  readonly events: AgentEventConsumer;
  readonly #source: SSEAgentEventSource;
  readonly #baseUrl: string;
  readonly #fetchWithCreds: typeof fetch;
  readonly #abortController = new AbortController();

  constructor(
    readonly runId: string,
    readonly kind: string,
    baseUrl: string,
    fetchWithCreds: typeof fetch
  ) {
    this.#baseUrl = baseUrl;
    this.#fetchWithCreds = fetchWithCreds;
    this.events = new AgentEventConsumer();
    this.#source = new SSEAgentEventSource(
      baseUrl,
      runId,
      this.events,
      this.#fetchWithCreds,
      this.#abortController.signal
    );
  }

  /**
   * Start consuming the SSE stream.
   * Resolves when the stream completes (finish/error event).
   */
  connect(): Promise<void> {
    return this.#source.connect();
  }

  resolveInput(response: AgentInputResponse): void {
    // POST to /input to resume the server-side pending request.
    const url = `${this.#baseUrl}/api/agent/${this.runId}/input`;
    this.#fetchWithCreds(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: response.requestId,
        response,
      }),
      signal: this.#abortController.signal,
    }).catch((err) => {
      console.error("SSEAgentRun: failed to POST /input", err);
    });
  }

  abort(): void {
    this.#abortController.abort();
    // Best-effort abort on the server
    const url = `${this.#baseUrl}/api/agent/${this.runId}/abort`;
    this.#fetchWithCreds(url, { method: "POST" }).catch(() => {
      /* ignore — the run may already be done */
    });
  }

  get aborted(): boolean {
    return this.#abortController.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.#abortController.signal;
  }
}
