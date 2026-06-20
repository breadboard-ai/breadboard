/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Service for running graphs on the Heartstone backend via SSE.
 *
 * Follows the same service pattern as {@link AgentService}: eagerly
 * configured with URL + fetch + flag predicate; the flag is read at
 * `startRun()` time so toggling it in Settings takes effect immediately.
 *
 * Protocol:
 * 1. `POST /v1beta1/graphSessions/new`  → `{ sessionId }`
 * 2. `GET  /v1beta1/graphSessions/{id}` → SSE stream of graph events
 * 3. `POST /v1beta1/graphSessions/{id}:resume` → inject input response
 * 4. `POST /v1beta1/graphSessions/{id}:cancel` → cancel session
 *
 * The SSE stream is designed for disconnect/reconnect: on suspend
 * (e.g. `inputRequired`), the client closes the stream, collects
 * user input, POSTs `:resume`, then opens a new stream to the same
 * session. The backend keeps the session alive across connections.
 */

import { iteratorFromStream } from "@breadboard-ai/utils";

export { GraphRunService };
export type { GraphRunEvent, GraphRunSession, SessionStatusEvent };

// ---------------------------------------------------------------------------
// Event types emitted by the Heartstone backend SSE stream
// ---------------------------------------------------------------------------

/**
 * Common base for all SSE events — the backend assigns a monotonic
 * `index` to every event so the client can reconnect with `?after=N`.
 */
interface GraphRunEventBase {
  index?: number;
}

/** Union of all event types the backend emits on the SSE stream. */
type GraphRunEvent = GraphRunEventBase &
  (
    | { type: "graphStart"; sessionId: string }
    | { type: "nodeStart"; nodeId: string }
    | { type: "nodeEnd"; nodeId: string; outputs?: Record<string, unknown> }
    | { type: "nodeError"; nodeId: string; error: string }
    | {
        type: "agentEvent";
        nodeId: string;
        event: Record<string, unknown>;
      }
    | {
        type: "thoughtEvent";
        nodeId: string;
        text: string;
      }
    | {
        type: "inputRequired";
        nodeId: string;
        interactionId: string;
        suspendEvent?: Record<string, unknown>;
      }
    | {
        type: "graphComplete";
        sessionId: string;
        outputs: Record<string, Record<string, unknown>>;
      }
    | { type: "graphError"; sessionId: string; error: string }
    | { type: "graphCancelled"; sessionId: string }
    | { type: "replayComplete" }
  );

/** Event shape emitted by the session monitor SSE stream. */
interface SessionStatusEvent {
  sessionId: string;
  status: string;
  createdAt: number;
}

/**
 * Handle for a running graph session. Separates session lifecycle
 * from stream lifecycle to support disconnect/reconnect on suspend.
 */
interface GraphRunSession {
  /** The backend session ID. */
  readonly sessionId: string;

  /**
   * Open (or reconnect) the SSE event stream.
   *
   * Returns an async iterable over events. The iterable ends when:
   * - The stream closes normally (backend done)
   * - The caller aborts the signal
   *
   * Call this again after resume to reconnect.
   */
  openStream(signal?: AbortSignal): AsyncIterable<GraphRunEvent>;

  /** Resume a suspended node (graph-level or agent-level input). */
  resume(interactionId: string, response: unknown): Promise<void>;

  /** Cancel the backend session (best-effort). */
  cancel(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class GraphRunService {
  #baseUrl = "";
  #fetchFn: typeof fetch = fetch;
  #isEnabled: () => boolean = () => false;

  /**
   * Configure the backend connection. Called once at app startup.
   *
   * @param baseUrl  — e.g. `"http://localhost:8080"` or production URL.
   * @param fetchFn  — authenticated fetch (usually `fetchWithCreds`).
   * @param isEnabled — predicate reading the flag at call time.
   */
  configureRemote(
    baseUrl: string,
    fetchFn: typeof fetch,
    isEnabled: () => boolean
  ): void {
    this.#baseUrl = baseUrl;
    this.#fetchFn = fetchFn;
    this.#isEnabled = isEnabled;
  }

  /** Whether the backend graph runner is enabled right now. */
  get enabled(): boolean {
    return this.#isEnabled();
  }

  /**
   * Create a graph session on the backend and return a session handle.
   *
   * The session handle supports disconnect/reconnect: call
   * `openStream()` to consume events, close the stream on suspend,
   * call `resume()`, then call `openStream()` again.
   */
  async createSession(
    graph: Record<string, unknown>,
    graphId: string,
    signal?: AbortSignal
  ): Promise<GraphRunSession> {
    const createUrl = `${this.#baseUrl}/v1beta1/graphSessions/new`;
    const createResp = await this.#fetchFn(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph, graphId }),
      signal,
    });

    if (!createResp.ok) {
      throw new Error(
        `Graph session creation failed: ${createResp.status} ${createResp.statusText}`
      );
    }

    const { sessionId } = (await createResp.json()) as { sessionId: string };
    const fetchFn = this.#fetchFn;
    const baseUrl = this.#baseUrl;

    // Cursor: the highest event index we've seen. Used to avoid
    // replaying old events on reconnect.
    let cursor = -1;

    return {
      sessionId,

      openStream(signal?: AbortSignal): AsyncIterable<GraphRunEvent> {
        // Include ?after=N to skip events we've already processed.
        const streamUrl =
          `${baseUrl}/v1beta1/graphSessions/${sessionId}?after=${cursor}`;
        // Return an async iterable that lazily opens the stream.
        return {
          [Symbol.asyncIterator]() {
            let started = false;
            let iterator: AsyncIterator<GraphRunEvent> | null = null;

            return {
              async next(): Promise<IteratorResult<GraphRunEvent>> {
                if (!started) {
                  started = true;
                  const resp = await fetchFn(streamUrl, { signal });
                  if (!resp.ok) {
                    throw new Error(
                      `Graph SSE stream failed: ${resp.status} ${resp.statusText}`
                    );
                  }
                  if (!resp.body) {
                    throw new Error("Graph SSE response has no body");
                  }
                  const iterable =
                    iteratorFromStream<GraphRunEvent>(resp.body);
                  iterator = iterable[Symbol.asyncIterator]();
                }
                const result = await iterator!.next();
                // Track the cursor for reconnection.
                if (!result.done && typeof result.value.index === "number") {
                  cursor = Math.max(cursor, result.value.index);
                }
                return result;
              },
            };
          },
        };
      },

      async resume(
        interactionId: string,
        response: unknown
      ): Promise<void> {
        const url = `${baseUrl}/v1beta1/graphSessions/${sessionId}:resume`;
        const resp = await fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interactionId, response }),
        });
        if (!resp.ok) {
          throw new Error(
            `Resume failed: ${resp.status} ${resp.statusText}`
          );
        }
      },

      async cancel(): Promise<void> {
        const url = `${baseUrl}/v1beta1/graphSessions/${sessionId}:cancel`;
        try {
          await fetchFn(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          // Best-effort — signal may have already killed the fetch.
        }
      },
    };
  }

  /**
   * Connect to an existing session (for reconnection/replay).
   *
   * Returns the same GraphRunSession handle as createSession, but
   * without creating a new session on the backend. The stream starts
   * from index 0 (full replay) or from a cursor position.
   */
  connectSession(sessionId: string): GraphRunSession {
    const fetchFn = this.#fetchFn;
    const baseUrl = this.#baseUrl;
    let cursor = -1;

    return {
      sessionId,

      openStream(signal?: AbortSignal): AsyncIterable<GraphRunEvent> {
        const streamUrl =
          `${baseUrl}/v1beta1/graphSessions/${sessionId}?after=${cursor}`;
        return {
          [Symbol.asyncIterator]() {
            let started = false;
            let iterator: AsyncIterator<GraphRunEvent> | null = null;

            return {
              async next(): Promise<IteratorResult<GraphRunEvent>> {
                if (!started) {
                  started = true;
                  const resp = await fetchFn(streamUrl, { signal });
                  if (!resp.ok) {
                    throw new Error(
                      `Graph SSE stream failed: ${resp.status} ${resp.statusText}`
                    );
                  }
                  if (!resp.body) {
                    throw new Error("Graph SSE response has no body");
                  }
                  const iterable =
                    iteratorFromStream<GraphRunEvent>(resp.body);
                  iterator = iterable[Symbol.asyncIterator]();
                }
                const result = await iterator!.next();
                if (!result.done && typeof result.value.index === "number") {
                  cursor = Math.max(cursor, result.value.index);
                }
                return result;
              },
            };
          },
        };
      },

      async resume(
        interactionId: string,
        response: unknown
      ): Promise<void> {
        const url = `${baseUrl}/v1beta1/graphSessions/${sessionId}:resume`;
        const resp = await fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interactionId, response }),
        });
        if (!resp.ok) {
          throw new Error(
            `Resume failed: ${resp.status} ${resp.statusText}`
          );
        }
      },

      async cancel(): Promise<void> {
        const url = `${baseUrl}/v1beta1/graphSessions/${sessionId}:cancel`;
        try {
          await fetchFn(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          // Best-effort.
        }
      },
    };
  }

  /**
   * Open a monitor SSE stream for a graph's session list.
   *
   * Yields `sessionStatus` events — one per existing session initially,
   * then live updates as sessions are created, change status, or are
   * deleted (status: "deleted").
   */
  async *monitorSessions(
    graphId: string,
    signal?: AbortSignal
  ): AsyncIterable<SessionStatusEvent> {
    const url =
      `${this.#baseUrl}/v1beta1/graphSessions?graphId=${encodeURIComponent(graphId)}`;
    const resp = await this.#fetchFn(url, { signal });
    if (!resp.ok) {
      throw new Error(
        `Session monitor failed: ${resp.status} ${resp.statusText}`
      );
    }
    if (!resp.body) {
      throw new Error("Session monitor response has no body");
    }
    const iterable = iteratorFromStream<SessionStatusEvent>(resp.body);
    yield* iterable;
  }

  /** Delete a session on the backend. */
  async deleteSession(sessionId: string): Promise<void> {
    const url =
      `${this.#baseUrl}/v1beta1/graphSessions/${sessionId}`;
    const resp = await this.#fetchFn(url, {
      method: "DELETE",
    });
    if (!resp.ok) {
      throw new Error(
        `Delete session failed: ${resp.status} ${resp.statusText}`
      );
    }
  }
}

