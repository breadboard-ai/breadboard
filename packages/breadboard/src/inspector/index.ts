/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardLoader } from "../loader.js";
import { GraphDescriptor } from "../types.js";
import { inspectableGraph } from "./graph.js";
import { InspectableGraphLoader } from "./types.js";

export { inspectableGraph } from "./graph.js";

/**
 * Use this function to create a simple graph loader for inspection.
 *
 * Example:
 *
 * ```ts
 * const inspectable = inspectableGraph(someGraphDescriptor);
 * const invoke = inspectable.nodesByType("invoke")[0];
 * const subgraph = invoke.subgraph(
 *   loadToInspect(new URL("http://localhost:3000"))
 * );
 * ```
 *
 * @param base the base URL that will be used to resolve the path to the
 * subgraph in case it's relative
 * @returns the `InspectableGraph`
 */
export const loadToInspect = (base: URL): InspectableGraphLoader => {
  return async (
    graph: string | GraphDescriptor,
    loadingGraph: GraphDescriptor
  ) => {
    if (graph === undefined) {
      return undefined;
    } else if (typeof graph === "string") {
      // This logic is lifted from `BoardRunner.load`.
      // TODO: Deduplicate.
      const graphs = loadingGraph.graphs;
      const loader = new BoardLoader({ base, graphs });
      const result = await loader.load(graph);
      if (!result) return undefined;
      return inspectableGraph(result.graph);
    } else {
      // TODO: Check that this is a valid GraphDescriptor
      return inspectableGraph(graph);
    }
  };
};
