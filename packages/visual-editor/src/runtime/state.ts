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

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager implements RuntimeContext {
  ui: State.UI;
  #map: Map<MainGraphIdentifier, State.Project> = new Map();
  #store: MutableGraphStore;

  readonly lite: LiteModeState;

  constructor(
    // Omitting state to avoid circular references
    private readonly runtime: Omit<Runtime, "state">,
    store: MutableGraphStore
  ) {
    this.#store = store;
    this.ui = State.createUIState(this.runtime.flags);
    this.lite = createLiteModeState(this);
  }

  get project(): Project | null {
    const tab = this.runtime.board.currentTab;
    if (!tab) return null;

    const mainGraphId = tab.mainGraphId;
    const editor = this.runtime.edit.getEditor(tab);
    return this.getOrCreateProjectState(mainGraphId, editor);
  }

  get router() {
    return this.runtime.router;
  }

  private getOrCreateProjectState(
    mainGraphId: MainGraphIdentifier,
    editable: EditableGraph | null
  ): State.Project | null {
    if (!mainGraphId) return null;

    let state = this.#map.get(mainGraphId);
    if (state) return state;

    const mutable = this.#store.get(mainGraphId);
    if (!mutable) return null;

    state = State.createProjectState(
      mainGraphId,
      this.#store,
      this.runtime.fetchWithCreds,
      this.runtime.googleDriveBoardServer,
      this.runtime.mcpClientManager,
      editable || undefined
    );
    this.#map.set(mainGraphId, state);
    return state;
  }
}
