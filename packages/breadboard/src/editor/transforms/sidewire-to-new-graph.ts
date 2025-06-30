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
import { ConfigureSidewireTransform } from "./configure-sidewire.js";
import { MoveToNewGraphTransform } from "./move-to-new-graph.js";

export { SidewireToNewGraphTransform };

/**
 * Given a selection of nodes and a subwire configuration information,
 * creates a new subgraph from these nodes, then configures specified
 * node to point to that subgraph.
 */
class SidewireToNewGraphTransform implements EditTransform {
  constructor(
    /**
     * The id of the node on which to configure the subwire.
     */
    public readonly nodeId: NodeIdentifier,
    /**
     * The port name that will be used to configure the subwire.
     */
    public readonly sidewirePortName: string,
    /**
     * The graph id of the specified node ("" means main board).
     */
    public readonly sourceGraphId: GraphIdentifier,
    /**
     * The id of the graph that will be created from selected nodes.
     */
    public readonly newGraphId: GraphIdentifier,
    /**
     * The nodes that will be moved to new graph.
     */
    public readonly nodes: NodeIdentifier[],
    /**
     * The title of the newly created graph.
     */
    public readonly title: string,
    /**
     * The description of the newly created graph.
     */
    public readonly description: string = ""
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const moving = await new MoveToNewGraphTransform(
      this.nodes,
      this.sourceGraphId,
      this.newGraphId,
      this.title,
      this.description
    ).apply(context);
    if (!moving.success) {
      return moving;
    }

    const wiring = await new ConfigureSidewireTransform(
      this.nodeId,
      this.sidewirePortName,
      this.sourceGraphId,
      this.newGraphId
    ).apply(context);

    if (!wiring.success) {
      return wiring;
    }

    return { success: true };
  }
}
