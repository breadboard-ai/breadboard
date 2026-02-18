/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import type { AgentInputResponse } from "./agent-event.js";
import {
  AgentEventConsumer,
  LocalAgentEventBridge,
} from "./agent-event-consumer.js";
import type { AgentEventSink } from "./agent-event-sink.js";

export { AgentService };
export type { AgentRunHandle, AgentRunConfig };

/**
 * Configuration for starting a new agent run.
 *
 * The `kind` field selects which agent loop to execute (content generation,
 * graph editing, or future kinds). The `objective` is the user's goal.
 *
 * Additional kind-specific configuration can be added as needed.
 */
type AgentRunConfig = {
  kind: string;
  objective: LLMContent;
};

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

  /**
   * The event sink for this run.
   * Used by the agent loop (producer side) to emit events.
   * Today this is a LocalAgentEventBridge; tomorrow, SSE on the server.
   */
  readonly sink: AgentEventSink;

  /**
   * Resume a suspended request (chat input or choice).
   * The `requestId` must match the one from the suspend event.
   */
  resolveInput(response: AgentInputResponse): void;

  /** Cancel this run. */
  abort(): void;

  /** Whether this run has been aborted. */
  readonly aborted: boolean;

  /** The AbortSignal for this run, usable by the agent loop. */
  readonly signal: AbortSignal;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Internal implementation of `AgentRunHandle`.
 *
 * Uses a `LocalAgentEventBridge` for in-process communication between
 * the agent loop (sink) and the event consumer. When the server exists,
 * this will be replaced with an SSE-backed implementation — but the
 * `AgentRunHandle` interface stays the same.
 */
class AgentRun implements AgentRunHandle {
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

  resolveInput(response: AgentInputResponse): void {
    // In the local bridge, suspend events resolve through the
    // consumer's handler Promise chain — the consumer handler
    // for waitForInput/waitForChoice returns a Promise that the
    // bridge awaits. resolveInput is a no-op in this mode because
    // the UI handler directly resolves the Promise.
    //
    // When SSE replaces the bridge, this method will POST the
    // response to the server endpoint that resolves the pending map.
    void response;
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
 * The service is transport-agnostic: today it creates in-process bridges,
 * tomorrow it can POST to the server and open SSE streams.
 *
 * ## SCA Integration
 *
 * - Lives in the **Service** layer (stateless lifecycle management).
 * - **Actions** call `startRun()` and wire the returned handle's
 *   consumer to the appropriate **Controllers** for the agent kind.
 * - Multiple runs can be live concurrently (e.g., content agent
 *   running while a graph-editing chat is open).
 *
 * ## Server Mapping
 *
 * | Client method              | Server endpoint                      |
 * |----------------------------|--------------------------------------|
 * | `startRun(config)`         | `POST /api/agent/run`                |
 * | `handle.events` (consumer) | `GET /api/agent/{runId}/events` (SSE)|
 * | `handle.resolveInput()`    | `POST /api/agent/{runId}/input`      |
 * | `handle.abort()`           | `POST /api/agent/{runId}/abort`      |
 */
class AgentService {
  readonly #runs = new Map<string, AgentRun>();

  /**
   * Create and start a new agent run.
   *
   * Returns a handle that the caller uses to:
   * 1. Wire event handlers (via `handle.events`)
   * 2. Pass `handle.sink` to the agent loop (producer)
   * 3. Cancel the run (via `handle.abort()`)
   */
  startRun(config: AgentRunConfig): AgentRunHandle {
    const runId = crypto.randomUUID();
    const run = new AgentRun(runId, config.kind);
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
