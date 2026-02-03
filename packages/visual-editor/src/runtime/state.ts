/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from "../ui/index.js";
import { Project, RuntimeContext } from "../ui/state/types.js";
import { EditableGraph, MainGraphIdentifier } from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { FlowGenerator } from "../ui/flow-gen/flow-generator.js";
import { SCA } from "../sca/sca.js";

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager implements RuntimeContext {
  #currentMainGraphId: MainGraphIdentifier | null = null;

  @signal
  accessor project: Project | null = null;

  readonly flowGenerator: FlowGenerator;

  constructor(private readonly __sca: SCA) {
    this.flowGenerator = __sca.services.flowGenerator;
  }

  /**
   * Syncs project state from the SCA controller.
   * Called directly after load/close actions.
   */
  syncProjectState(): void {
    const tab = this.__sca.controller.editor.graph.asTab();
    if (!tab) {
      // When the tab is null and the main graph id is not null, we are in the
      // process of closing a tab. Reset the state.
      if (this.#currentMainGraphId) {
        this.#currentMainGraphId = null;
        this.project = null;
      }
      return;
    }
    const mainGraphId = tab.mainGraphId;
    if (mainGraphId === this.#currentMainGraphId) return;
    this.#currentMainGraphId = mainGraphId;
    const editor = this.__sca.controller.editor.graph.editor;
    this.project = this.createProjectState(editor);
  }

  get router() {
    return this.__sca.controller.router;
  }

  private createProjectState(
    editable: EditableGraph | null
  ): State.Project | null {
    if (!editable) {
      console.warn(`No editable graph provided: cannot create project state`);
      return null;
    }

    return State.createProjectState(
      this.__sca.services.fetchWithCreds,
      this.__sca.services.googleDriveBoardServer,
      this.__sca.services.actionTracker,
      this.__sca.services.mcpClientManager,
      editable
    );
  }
}
