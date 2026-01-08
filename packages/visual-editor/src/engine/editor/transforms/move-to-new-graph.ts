/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { MoveToGraphTransform } from "./move-to-graph.js";

export { MoveToNewGraphTransform };

class MoveToNewGraphTransform implements EditTransform {
  #nodes: NodeIdentifier[];
  #source: GraphIdentifier;
  #destination: GraphIdentifier;
  #title: string;
  #description: string;

  constructor(
    nodes: NodeIdentifier[],
    source: GraphIdentifier,
    destination: GraphIdentifier,
    title: string,
    description: string = ""
  ) {
    this.#nodes = nodes;
    this.#source = source;
    this.#destination = destination;
    this.#title = title;
    this.#description = description;
  }

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const addingGraph = await context.apply(
      [
        {
          type: "addgraph",
          id: this.#destination,
          graph: {
            title: this.#title,
            description: this.#description,
            nodes: [],
            edges: [],
          },
        },
      ],
      ""
    );
    if (!addingGraph.success) {
      return addingGraph;
    }

    const moveToGraph = await new MoveToGraphTransform(
      this.#nodes,
      this.#source,
      this.#destination
    ).apply(context);

    if (!moveToGraph.success) {
      return moveToGraph;
    }

    return { success: true };
  }
}
