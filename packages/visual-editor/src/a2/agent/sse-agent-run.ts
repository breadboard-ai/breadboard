/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentEventConsumer } from "./agent-event-consumer.js";
import type { RemoteAgentRunConfig, AgentRunHandle } from "./agent-service.js";
import type { Segment } from "./resolve-to-segments.js";
import { SSEAgentEventSource } from "./sse-agent-event-source.js";

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
 * Remote agent run backed by SSE (Resumable Stream Protocol).
 *
 * Instead of running the agent loop in-process, this connects to a
 * remote server via a single POST request that returns an SSE stream.
 *
 * The POST body carries structured segments + flags (wire protocol).
 * The server calls `to_pidgin(segments)` to produce pidgin text and
 * handles all data part registration + tag generation.
 */
class SSEAgentRun implements AgentRunHandle {
  readonly events: AgentEventConsumer;
  readonly #source: SSEAgentEventSource;
  readonly #abortController = new AbortController();

  constructor(
    readonly runId: string,
    readonly kind: string,
    baseUrl: string,
    config: RemoteAgentRunConfig,
    fetchWithCreds: typeof fetch
  ) {
    this.events = new AgentEventConsumer();
    this.#source = new SSEAgentEventSource(
      baseUrl,
      {
        kind: config.kind,
        segments: config.segments.map(segmentToProto),
        flags: config.flags,
        graph: config.graph,
      },
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
    this.#abortController.abort();
  }

  get aborted(): boolean {
    return this.#abortController.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.#abortController.signal;
  }
}
