/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from "@breadboard-ai/shared-ui";
import { createLiteModeState } from "@breadboard-ai/shared-ui/state/lite-mode.js";
import {
  LiteModeState,
  Project,
  RuntimeContext,
} from "@breadboard-ai/shared-ui/state/types.js";
import {
  EditableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
} from "@google-labs/breadboard";
import { Runtime } from "./runtime";
import { RuntimeTabChangeEvent } from "./events";
import { signal } from "signal-utils";
import { FlowGenerator } from "@breadboard-ai/shared-ui/flow-gen/flow-generator.js";

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager implements RuntimeContext {
  ui: State.UI;
  #currentMainGraphId: MainGraphIdentifier | null = null;
  #store: MutableGraphStore;

  @signal
  accessor project: Project | null = null;

  readonly lite: LiteModeState;

  readonly flowGenerator: FlowGenerator;

  constructor(
    // Omitting state to avoid circular references
    private readonly runtime: Omit<Runtime, "state">,
    store: MutableGraphStore
  ) {
    this.#store = store;
    this.flowGenerator = this.runtime.flowGenerator;
    this.ui = State.createUIState(this.runtime.flags);
    this.lite = createLiteModeState(this);
    this.runtime.board.addEventListener(RuntimeTabChangeEvent.eventName, () => {
      const tab = this.runtime.board.currentTab;
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
      const editor = this.runtime.edit.getEditor(tab);
      this.project = this.createProjectState(mainGraphId, editor);
    });
  }

  get router() {
    return this.runtime.router;
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
      this.runtime.fetchWithCreds,
      this.runtime.googleDriveBoardServer,
      this.runtime.mcpClientManager,
      editable || undefined
    );
  }
}
