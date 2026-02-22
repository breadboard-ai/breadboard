/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import type { AgentEventConsumer } from "./agent-event-consumer.js";
import type { Segment, SegmentResolution } from "./resolve-to-segments.js";

import { LocalAgentRun } from "./local-agent-run.js";
import { SSEAgentRun } from "./sse-agent-run.js";

export { AgentService };
export type { AgentRunHandle, AgentRunConfig, RemoteAgentRunConfig };

/**
 * Configuration for starting a new agent run.
 *
 * Two variants:
 * - **Local mode**: carries `objective` (LLMContent) for in-process
 *   `toPidgin` + loop execution.
 * - **Remote mode**: carries `segments` + `flags` (wire protocol).
 *   The server owns pidgin tag generation.
 */
type LocalAgentRunConfig = {
  kind: string;
  objective: LLMContent;
};

type RemoteAgentRunConfig = {
  kind: string;
  segments: Segment[];
  flags: SegmentResolution["flags"];
};

type AgentRunConfig = LocalAgentRunConfig | RemoteAgentRunConfig;

/**
 * A handle to a single live agent run.
 *
 * Each run has its own event consumer (for subscribing to events),
 * its own AbortController, and its own pending-request map.
 * Multiple runs can be live simultaneously.
 *
 * The `events` consumer is where callers wire up handlers for this
 * specific run — connecting agent events to the appropriate controllers
 * (ConsoleProgressManager, GraphEditingAgentController, etc.).
 */
interface AgentRunHandle {
  /** Unique identifier for this run. */
  readonly runId: string;

  /** The agent kind (e.g. "content", "graph-editing"). */
  readonly kind: string;

  /**
   * The event consumer for this run.
   * Register handlers here to process events from the agent loop.
   */
  readonly events: AgentEventConsumer;

  /** Cancel this run. */
  abort(): void;

  /** Whether this run has been aborted. */
  readonly aborted: boolean;

  /** The AbortSignal for this run, usable by the agent loop. */
  readonly signal: AbortSignal;
}

// =============================================================================
// AgentService
// =============================================================================

/**
 * The agent run lifecycle manager.
 *
 * An SCA Service that manages concurrent agent runs. Each call to
 * `startRun()` creates a new `AgentRunHandle` with its own event
 * consumer, abort controller, and (future) pending-request map.
 *
 * The service is transport-agnostic: in local mode it creates
 * `LocalAgentRun` instances with in-process bridges, in remote
 * mode it creates `SSEAgentRun` instances that connect via SSE.
 *
 * ## SCA Integration
 *
 * - Lives in the **Service** layer (stateless lifecycle management).
 * - **Actions** call `startRun()` and wire the returned handle's
 *   consumer to the appropriate **Controllers** for the agent kind.
 * - Multiple runs can be live concurrently (e.g., content agent
 *   running while a graph-editing chat is open).
 *
 * ## Server Mapping (Resumable Stream Protocol)
 *
 * | Client method              | Server endpoint                      |
 * |----------------------------|--------------------------------------|
 * | `startRun(config)`         | `POST /api/agent/run` → SSE stream   |
 * | `handle.events` (consumer) | (events arrive in the SSE response)  |
 * | `handle.abort()`           | Client closes the connection         |
 */
class AgentService {
  readonly #runs = new Map<string, AgentRunHandle>();

  /**
   * Remote server URL. When set, `startRun()` creates `SSEAgentRun`
   * instances that connect via SSE. When null, local mode is used.
   *
   * Set via `configureRemote()` — intended for tests and dev mode.
   */
  #remoteBaseUrl: string | null = null;
  #remoteFetchWithCreds: typeof fetch = fetch;

  /**
   * Configure the service for remote (SSE) mode.
   *
   * When `baseUrl` is set, `startRun()` will POST to the server and
   * return an `SSEAgentRun` that streams events via SSE.
   * The `fetchFn` is used for all HTTP requests (typically `fetchWithCreds`).
   *
   * Pass `null` for baseUrl to revert to local mode.
   */
  configureRemote(
    baseUrl: string | null,
    fetchWithCreds: typeof fetch = fetch
  ): void {
    this.#remoteBaseUrl = baseUrl;
    this.#remoteFetchWithCreds = fetchWithCreds;
  }

  /** Whether the service is configured for remote (SSE) mode. */
  get isRemote(): boolean {
    return this.#remoteBaseUrl !== null;
  }

  /**
   * Create and start a new agent run.
   *
   * Returns a handle that the caller uses to:
   * 1. Wire event handlers (via `handle.events`)
   * 2. Cancel the run (via `handle.abort()`)
   *
   * In local mode, downcast to `LocalAgentRun` to access the `sink`.
   */
  startRun(config: AgentRunConfig): AgentRunHandle {
    const runId = crypto.randomUUID();

    let run: AgentRunHandle;
    if (this.#remoteBaseUrl) {
      if (!("segments" in config)) {
        throw new Error("Remote mode requires RemoteAgentRunConfig (segments)");
      }
      run = new SSEAgentRun(
        runId,
        config.kind,
        this.#remoteBaseUrl,
        config,
        this.#remoteFetchWithCreds
      );
    } else {
      run = new LocalAgentRun(runId, config.kind);
    }

    this.#runs.set(runId, run);
    return run;
  }

  /** Look up a live run by ID. */
  getRun(runId: string): AgentRunHandle | undefined {
    return this.#runs.get(runId);
  }

  /**
   * Remove a completed or aborted run from the active set.
   * Call this after the agent loop finishes to avoid memory leaks.
   */
  endRun(runId: string): void {
    this.#runs.delete(runId);
  }

  /** All currently active run IDs. */
  get activeRunIds(): string[] {
    return [...this.#runs.keys()];
  }
}
