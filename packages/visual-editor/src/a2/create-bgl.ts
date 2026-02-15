/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";

export { createBgl };

function createBgl<G, I>(g: G, _i: Record<string, I>): GraphDescriptor {
  const graph = structuredClone(g) as GraphDescriptor;

  return graph;
}
