/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import type { AgentEventSink } from "../agent-event-sink.js";
import type { ReadGraphResponse } from "./types.js";

export { readGraph };

/**
 * Reads the current graph via the suspend mechanism.
 */
async function readGraph(sink: AgentEventSink): Promise<GraphDescriptor> {
  const { graph } = await sink.suspend<ReadGraphResponse>({
    readGraph: {
      requestId: crypto.randomUUID(),
    },
  });
  return graph;
}
