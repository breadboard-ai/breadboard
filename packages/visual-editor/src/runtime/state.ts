/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from "@breadboard-ai/shared-ui";

import {
  EditableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
} from "@google-labs/breadboard";
import { BoardState } from "./types";

export { StateManager };

/**
 * Holds various important bits of UI state
 */
class StateManager {
  #map: Map<MainGraphIdentifier, BoardState> = new Map();
  #store: MutableGraphStore;

  constructor(store: MutableGraphStore) {
    this.#store = store;
  }

  getOrCreate(
    mainGraphId?: MainGraphIdentifier,
    editable?: EditableGraph | null
  ): BoardState | null {
    if (!mainGraphId) return null;

    let state = this.#map.get(mainGraphId);
    if (state) return state;

    const mutable = this.#store.get(mainGraphId);
    if (!mutable) return null;

    state = State.createProjectState(
      mainGraphId,
      this.#store,
      editable || undefined
    );
    this.#map.set(mainGraphId, state);
    return state;
  }
}
