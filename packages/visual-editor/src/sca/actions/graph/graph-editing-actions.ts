/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  EditableGraph,
  GraphIdentifier,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
} from "@breadboard-ai/types";
import {
  bind,
  addNode,
  changeEdge,
  changeNodeConfiguration,
} from "./graph-actions.js";

export { getGraphEditingActions };

/**
 * Graph editing callbacks that mirror SCA Actions.
 * Injected by the SCA layer so the agent can edit the
 * graph through the same code path as user interactions.
 */
export type GraphEditingActions = {
  getEditor(): EditableGraph | null;
  addNode(node: NodeDescriptor, graphId: GraphIdentifier): Promise<void>;
  changeEdge(
    changeType: "add" | "remove" | "move",
    from: Edge,
    to?: Edge,
    subGraphId?: string | null
  ): Promise<void>;
  changeNodeConfiguration(
    id: NodeIdentifier,
    graphId: GraphIdentifier,
    configurationPart: NodeConfiguration
  ): Promise<void>;
};

/**
 * Returns a `GraphEditingActions` object that wraps the SCA graph editing
 * actions. This is used by the agent layer to edit the graph through the
 * same code path as the UI.
 */
function getGraphEditingActions(): GraphEditingActions {
  return {
    getEditor() {
      const { controller } = bind;
      return controller.editor.graph.editor;
    },
    addNode,
    changeEdge,
    changeNodeConfiguration,
  };
}
