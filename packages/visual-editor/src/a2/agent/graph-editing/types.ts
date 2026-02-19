/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";

export type { ReadGraphResponse, ApplyEditsResponse };

/**
 * Response from a `readGraph` suspend event.
 * The client reads `editor.raw()` and responds with the graph.
 */
type ReadGraphResponse = {
  graph: GraphDescriptor;
};

/**
 * Response from an `applyEdits` suspend event.
 * The client applies the edits/transform and confirms success/failure.
 */
type ApplyEditsResponse = {
  success: boolean;
  error?: string;
};
