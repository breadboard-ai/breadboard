/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphEditingActions } from "../../../a2/runnable-module-factory.js";
import {
  bind,
  addNode,
  changeEdge,
  changeNodeConfiguration,
} from "./graph-actions.js";

export { getGraphEditingActions };

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
