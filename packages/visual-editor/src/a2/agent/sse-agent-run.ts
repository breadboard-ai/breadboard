/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentEventConsumer } from "./agent-event-consumer.js";
import type { RemoteAgentRunConfig, AgentRunHandle } from "./agent-service.js";
import type { Segment } from "./resolve-to-segments.js";
import { SSEAgentEventSource } from "./sse-agent-event-source.js";
import { StreamRunAgentEventSource } from "./stream-run-agent-event-source.js";

export { SSEAgentRun };

/**
 * Convert a flat segment (`{type: "text", text: "hello"}`) to
 * proto-compatible JSON (`{textSegment: {text: "hello"}}`).
 *
 * The proto `RunSegment` message uses `oneof segment` — the JSON key
 * selects the variant, not a `type` field.
 */
function segmentToProto(segment: Segment): Record<string, unknown> {
  // Strip the discriminant — proto oneof doesn't use "type".
  const { type, ...fields } = segment;
  const keyMap: Record<string, string> = {
    text: "textSegment",
    asset: "assetSegment",
    input: "inputSegment",
    tool: "toolSegment",
  };
  const key = keyMap[type];
  if (!key) {
    // Unknown segment type — pass through as-is for forward compat.
    return segment;
  }
  return { [key]: fields };
}

/**
 * Shared interface for event sources used by `SSEAgentRun`.
 *
 * Both `SSEAgentEventSource` (sessions protocol) and
 * `StreamRunAgentEventSource` (legacy protocol) implement this.
 */
interface AgentEventSource {
  connect(): Promise<void>;
  cancel(): Promise<void>;
}

/**
 * Remote agent run backed by SSE.
 *
 * Instead of running the agent loop in-process, this connects to a
 * remote server via SSE. The protocol (sessions vs. streamRunAgent)
 * is determined by the event source passed at construction time.
 */
class SSEAgentRun implements AgentRunHandle {
  readonly events: AgentEventConsumer;
  readonly #source: AgentEventSource;
  readonly #abortController = new AbortController();

  constructor(
    readonly runId: string,
    readonly kind: string,
    baseUrl: string,
    config: RemoteAgentRunConfig,
    fetchWithCreds: typeof fetch,
    useSessions: boolean
  ) {
    this.events = new AgentEventConsumer();
    const wireConfig = {
      kind: config.kind,
      segments: config.segments.map(segmentToProto),
      flags: config.flags,
      graph: config.graph,
    };

    this.#source = useSessions
      ? new SSEAgentEventSource(
          baseUrl,
          wireConfig,
          this.events,
          fetchWithCreds,
          this.#abortController.signal
        )
      : new StreamRunAgentEventSource(
          baseUrl,
          wireConfig,
          this.events,
          fetchWithCreds,
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

  abort(): void {
    this.#source.cancel();
    this.#abortController.abort();
  }

  get aborted(): boolean {
    return this.#abortController.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.#abortController.signal;
  }
}
