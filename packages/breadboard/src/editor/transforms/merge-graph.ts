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
import { MoveToGraphTransform } from "./move-to-graph.js";
import { GraphDescriptorHandle } from "../../inspector/graph/graph-descriptor-handle.js";

export { MergeGraphTransform };

class MergeGraphTransform implements EditTransform {
  #source: GraphIdentifier;
  #mergeInto: GraphIdentifier;

  constructor(source: GraphIdentifier, mergeInto: GraphIdentifier) {
    this.#source = source;
    this.#mergeInto = mergeInto;
  }

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const { graph } = context;

    const handle = GraphDescriptorHandle.create(graph, this.#source);
    if (!handle.success) {
      return handle;
    }

    const all = handle.result.graph().nodes.map((node) => node.id);

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
