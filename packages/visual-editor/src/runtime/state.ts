/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from "@breadboard-ai/shared-ui";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";
import { BoardServer } from "@breadboard-ai/types";
import {
  EditableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
} from "@google-labs/breadboard";

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager {
  #ui: State.UI | null = null;
  #map: Map<MainGraphIdentifier, State.Project> = new Map();
  #store: MutableGraphStore;
  #runtime: SideBoardRuntime;
  #servers: BoardServer[];

  constructor(
    store: MutableGraphStore,
    runtime: SideBoardRuntime,
    boardServers: BoardServer[]
  ) {
    this.#store = store;
    this.#runtime = runtime;
    this.#servers = boardServers;
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
      this.#ui = State.createUIState();
    }

    return this.#ui;
  }

  getOrCreateProjectState(
    mainGraphId?: MainGraphIdentifier,
    editable?: EditableGraph | null
  ): State.Project | null {
    if (!mainGraphId) return null;

    let state = this.#map.get(mainGraphId);
    if (state) return state;

    const mutable = this.#store.get(mainGraphId);
    if (!mutable) return null;

    state = State.createProjectState(
      mainGraphId,
      this.#store,
      this.#runtime,
      this.#findServer.bind(this),
      editable || undefined
    );
    this.#map.set(mainGraphId, state);
    return state;
  }
}
