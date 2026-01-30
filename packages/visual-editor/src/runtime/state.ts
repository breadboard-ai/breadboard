/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from "../ui/index.js";
import { createLiteModeState } from "../ui/state/lite-mode.js";
import { LiteModeState, Project, RuntimeContext } from "../ui/state/types.js";
import {
  EditableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { FlowGenerator } from "../ui/flow-gen/flow-generator.js";
import { SCA } from "../sca/sca.js";

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager implements RuntimeContext {
  #currentMainGraphId: MainGraphIdentifier | null = null;
  #store: MutableGraphStore;

  @signal
  accessor project: Project | null = null;

  readonly lite: LiteModeState;

  readonly flowGenerator: FlowGenerator;

  constructor(
    store: MutableGraphStore,
    private readonly __sca: SCA
  ) {
    this.#store = store;
    this.flowGenerator = __sca.services.flowGenerator;
    this.lite = createLiteModeState(this, __sca);
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
    this.project = this.createProjectState(mainGraphId, editor);
  }

  get router() {
    return this.__sca.controller.router;
  }

  private createProjectState(
    mainGraphId: MainGraphIdentifier,
    editable: EditableGraph | null
  ): State.Project | null {
    const mutable = this.#store.get(mainGraphId);
    if (!mutable) {
      console.warn(
        `No mutable graph found for ${mainGraphId}: this is an integrity problem, and will likely result in undefined behavior`
      );
      return null;
    }

    return State.createProjectState(
      mainGraphId,
      this.#store,
      this.__sca.services.fetchWithCreds,
      this.__sca.services.googleDriveBoardServer,
      this.__sca.services.actionTracker,
      this.__sca.services.mcpClientManager,
      editable || undefined
    );
  }
}
