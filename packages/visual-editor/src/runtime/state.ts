/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpClientManager } from "@breadboard-ai/mcp";
import { State } from "@breadboard-ai/shared-ui";
import { createLiteModeState } from "@breadboard-ai/shared-ui/state/lite-mode.js";
import {
  LiteModeState,
  Project,
  RuntimeContext,
  UI,
} from "@breadboard-ai/shared-ui/state/types.js";
import { RuntimeFlagManager } from "@breadboard-ai/types";
import {
  EditableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
} from "@google-labs/breadboard";
import { Runtime } from "./runtime";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager implements RuntimeContext {
  #ui: State.UI | null = null;
  #map: Map<MainGraphIdentifier, State.Project> = new Map();
  #store: MutableGraphStore;
  #fetchWithCreds: typeof globalThis.fetch;
  #boardServer: GoogleDriveBoardServer;
  #flagManager: RuntimeFlagManager;
  #mcpClientManager: McpClientManager;

  readonly lite: LiteModeState;

  constructor(
    private readonly runtime: Runtime,
    store: MutableGraphStore,
    fetchWithCreds: typeof globalThis.fetch,
    boardServer: GoogleDriveBoardServer,
    flagManager: RuntimeFlagManager,
    mcpClientManager: McpClientManager
  ) {
    this.#store = store;
    this.#fetchWithCreds = fetchWithCreds;
    this.#boardServer = boardServer;
    this.#flagManager = flagManager;
    this.#mcpClientManager = mcpClientManager;
    this.lite = createLiteModeState(this);
  }

  getOrCreateUIState() {
    if (!this.#ui) {
      this.#ui = State.createUIState(this.#flagManager);
    }

    return this.#ui;
  }

  get ui(): UI {
    return this.getOrCreateUIState();
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

  getProjectState(mainGraphId?: MainGraphIdentifier): State.Project | null {
    if (!mainGraphId) return null;

    return this.#map.get(mainGraphId) || null;
  }

  getOrCreateProjectState(
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
      this.#fetchWithCreds,
      this.#boardServer,
      this.#mcpClientManager,
      editable || undefined
    );
    this.#map.set(mainGraphId, state);
    return state;
  }
}
