/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
} from "../types.js";
import { toSubgraphContext } from "../subgraph-context.js";
import { MoveToGraphTransform } from "./move-to-graph.js";

export { MergeGraphTransform };

class MergeGraphTransform implements EditTransform {
  #source: GraphIdentifier;
  #mergeInto: GraphIdentifier;

  constructor(source: GraphIdentifier, mergeInto: GraphIdentifier) {
    this.#source = source;
    this.#mergeInto = mergeInto;
  }

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const sourceContext = toSubgraphContext(context, this.#source);
    if (!sourceContext.success) {
      return sourceContext;
    }

    const all = sourceContext.result.graph.nodes.map((node) => node.id);

    const moving = await new MoveToGraphTransform(
      all,
      this.#source,
      this.#mergeInto
    ).apply(context);

    if (!moving.success) {
      return moving;
    }

    const removingGraph = await context.apply(
      [{ type: "removegraph", id: this.#source }],
      ""
    );
    if (!removingGraph.success) {
      return removingGraph;
    }

    return { success: true };
  }
}
