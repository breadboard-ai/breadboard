/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpClientManager } from "@breadboard-ai/mcp";
import { State } from "@breadboard-ai/shared-ui";
import { createLiteViewState } from "@breadboard-ai/shared-ui/state/lite-view.js";
import {
  LiteViewState,
  Project,
  RuntimeContext,
} from "@breadboard-ai/shared-ui/state/types.js";
import { BoardServer, RuntimeFlagManager } from "@breadboard-ai/types";
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
  #ui: State.UI | null = null;
  #map: Map<MainGraphIdentifier, State.Project> = new Map();
  #store: MutableGraphStore;
  #fetchWithCreds: typeof globalThis.fetch;
  #servers: BoardServer[];
  #flagManager: RuntimeFlagManager;
  #mcpClientManager: McpClientManager;

  readonly liteView: LiteViewState;

  constructor(
    private readonly runtime: Runtime,
    store: MutableGraphStore,
    fetchWithCreds: typeof globalThis.fetch,
    boardServers: BoardServer[],
    flagManager: RuntimeFlagManager,
    mcpClientManager: McpClientManager
  ) {
    this.#store = store;
    this.#fetchWithCreds = fetchWithCreds;
    this.#servers = boardServers;
    this.#flagManager = flagManager;
    this.#mcpClientManager = mcpClientManager;
    this.liteView = createLiteViewState(this);
  }

  #findServer(url: URL): BoardServer | null {
    for (const server of this.#servers) {
      if (server.canProvide(url)) {
        return server;
      }
    }
    return null;
  }

  appendServer(boardServer: BoardServer | null) {
    if (
      !boardServer ||
      this.#servers.findIndex((server) => server === boardServer) !== -1
    ) {
      return;
    }

    this.#servers.push(boardServer);
  }

  getOrCreateUIState() {
    if (!this.#ui) {
      this.#ui = State.createUIState(this.#flagManager);
    }

    return this.#ui;
  }

  currentProjectState(): Project | null {
    const tab = this.runtime.board.currentTab;
    if (!tab) return null;

    const mainGraphId = tab.mainGraphId;
    const editor = this.runtime.edit.getEditor(tab);
    return this.getOrCreateProjectState(mainGraphId, editor);
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
      this.#findServer.bind(this),
      this.#mcpClientManager,
      editable || undefined
    );
    this.#map.set(mainGraphId, state);
    return state;
  }
}
