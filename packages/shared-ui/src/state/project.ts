/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, AssetPath } from "@breadboard-ai/types";
import {
  EditSpec,
  MainGraphIdentifier,
  MutableGraphStore,
  Outcome,
} from "@google-labs/breadboard";
import { SignalMap } from "signal-utils/map";
import { ReactiveOrganizer } from "./organizer";
import { Organizer, Project, ProjectInternal } from "./types";

export { ReactiveProject, createProjectState };

function createProjectState(
  mainGraphId: MainGraphIdentifier,
  store: MutableGraphStore
): Project {
  return new ReactiveProject(mainGraphId, store);
}

class ReactiveProject implements ProjectInternal {
  #mainGraphId: MainGraphIdentifier;
  #store: MutableGraphStore;
  readonly assets: SignalMap<AssetPath, Asset>;

  readonly organizer: Organizer;

  constructor(mainGraphId: MainGraphIdentifier, store: MutableGraphStore) {
    this.#mainGraphId = mainGraphId;
    this.#store = store;
    store.addEventListener("update", (event) => {
      if (event.mainGraphId === mainGraphId) {
        this.#updateAssets();
      }
    });
    this.assets = new SignalMap();
    this.organizer = new ReactiveOrganizer(this);
    this.#updateAssets();
  }

  async edit(spec: EditSpec[], label: string): Promise<Outcome<void>> {
    const editable = this.#store.edit(this.#mainGraphId);
    if (!editable) {
      return err(
        `Unable to get an editable graph with id "${this.#mainGraphId}"`
      );
    }

    const editing = await editable.edit(spec, label);
    if (!editing.success) {
      return err(editing.error);
    }
  }

  #updateAssets() {
    const mutable = this.#store.get(this.#mainGraphId);
    if (!mutable) return;

    const { assets = {} } = mutable.graph;

    const toDelete = new Set(this.assets.keys());

    Object.entries(assets).forEach(([path, asset]) => {
      this.assets.set(path, asset);
      toDelete.delete(path);
    });

    [...toDelete.values()].forEach((path) => {
      this.assets.delete(path);
    });
  }
}

function err($error: string) {
  return { $error };
}
