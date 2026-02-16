/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, NodeDescriptor } from "@breadboard-ai/types";

/**
 * Shared fixtures for SCA tests.
 *
 * Use these instead of defining inline fixtures in test files.
 */

/**
 * Creates a minimal test graph descriptor.
 *
 * @param options - Optional customization
 * @param options.url - Graph URL (default: "test://board")
 * @param options.nodes - Custom nodes (default: single promptTemplate node)
 * @param options.title - Graph title
 */
export function makeFreshGraph(options?: {
  url?: string;
  nodes?: NodeDescriptor[];
  title?: string;
}): GraphDescriptor {
  return {
    url: options?.url ?? "test://board",
    edges: [],
    nodes: options?.nodes ?? [{ id: "foo", type: "test:promptTemplate" }],
    ...(options?.title && { title: options.title }),
  };
}
