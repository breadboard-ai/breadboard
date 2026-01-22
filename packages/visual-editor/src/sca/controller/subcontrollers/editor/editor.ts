/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export * as Splitter from "./splitter/splitter-controller.js";
export * as Selection from "./selection/selection.js";
export * as Sidebar from "./sidebar/sidebar-controller.js";

import { RootController } from "../root-controller.js";
import { field } from "../../decorators/field.js";
import { EditableGraph, EditSpec } from "@breadboard-ai/types";

export class EditorController extends RootController {
  #currentGraph: EditableGraph | null = null;
  #disconnectOldGraph: (() => void) | null = null;

  @field()
  accessor version: number = 0;

  @field()
  accessor readOnly: boolean = false;

  @field()
  accessor graphId: string | null = null;

  /**
   * 2. The Context Switcher
   * Call this whenever the active tab changes.
   */
  setGraph(graph: EditableGraph | null, readOnly: boolean = false) {
    // A. Teardown old graph listeners
    if (this.#disconnectOldGraph) {
      this.#disconnectOldGraph();
      this.#disconnectOldGraph = null;
    }

    this.#currentGraph = graph;
    this.readOnly = readOnly;

    if (!graph) {
      this.graphId = null;
      return;
    }

    const changeHandler = () => {
      this.version++;
    };

    graph.addEventListener("graphchange", changeHandler);

    // D. Store cleanup logic for next time
    this.#disconnectOldGraph = () => {
      graph.removeEventListener("graphchange", changeHandler);
    };

    // E. Initial Tick
    this.version++;
  }

  /**
   * 3. The Operation Gatekeeper
   * Now "edit" just uses the internal reference.
   */
  async edit(edits: EditSpec[], description: string): Promise<boolean> {
    if (this.readOnly) {
      console.warn("Attempted to edit read-only graph");
      return false;
    }

    if (!this.#currentGraph) {
      throw new Error("No active graph loaded in EditorController");
    }

    const result = await this.#currentGraph.edit(edits, description);
    return result.success;
  }
}
