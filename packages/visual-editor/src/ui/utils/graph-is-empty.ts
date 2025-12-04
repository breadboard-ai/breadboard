/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";

export function isEmpty(graph: GraphDescriptor | null): boolean {
  if (!graph) {
    return true;
  }

  return (
    (graph.nodes ?? []).length === 0 &&
    Object.keys(graph.assets ?? {}).length === 0 &&
    Object.keys(graph.graphs ?? {}).length === 0
  );
}
