/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from "@breadboard-ai/shared-ui";

import {
  BoardServer,
  EditableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
} from "@google-labs/breadboard";

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager {
  #map: Map<MainGraphIdentifier, State.Project> = new Map();
  #store: MutableGraphStore;
  #servers: BoardServer[];

  constructor(store: MutableGraphStore, boardServers: BoardServer[]) {
    this.#store = store;
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

  getOrCreate(
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
      this.#findServer.bind(this),
      editable || undefined
    );
    this.#map.set(mainGraphId, state);
    return state;
  }
}
