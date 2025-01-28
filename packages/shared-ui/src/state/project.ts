/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, AssetPath } from "@breadboard-ai/types";
import {
  EditableGraph,
  EditSpec,
  MainGraphIdentifier,
  MutableGraphStore,
  Outcome,
} from "@google-labs/breadboard";
import { SignalMap } from "signal-utils/map";
import { ReactiveOrganizer } from "./organizer";
import { AtMenu, Organizer, Project, ProjectInternal } from "./types";

export { ReactiveProject, createProjectState };

function createProjectState(
  mainGraphId: MainGraphIdentifier,
  store: MutableGraphStore,
  editable?: EditableGraph
): Project {
  return new ReactiveProject(mainGraphId, store, editable);
}

class ReactiveProject implements ProjectInternal {
  #mainGraphId: MainGraphIdentifier;
  #store: MutableGraphStore;
  #editable?: EditableGraph;
  readonly graphAssets: SignalMap<AssetPath, Asset>;
  readonly organizer: Organizer;
  readonly atMenu: AtMenu;

  constructor(
    mainGraphId: MainGraphIdentifier,
    store: MutableGraphStore,
    editable?: EditableGraph
  ) {
    this.#mainGraphId = mainGraphId;
    this.#store = store;
    this.#editable = editable;
    store.addEventListener("update", (event) => {
      if (event.mainGraphId === mainGraphId) {
        this.#updateGraphAssets();
      }
    });
    this.graphAssets = new SignalMap();
    this.organizer = new ReactiveOrganizer(this);
    this.atMenu = {
      graphAssets: this.graphAssets,
      generatedAssets: [],
      tools: [],
      components: [],
    };
    this.#updateGraphAssets();
  }

  async edit(spec: EditSpec[], label: string): Promise<Outcome<void>> {
    const editable = this.#editable;
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

  #updateGraphAssets() {
    const mutable = this.#store.get(this.#mainGraphId);
    if (!mutable) return;

    const { assets = {} } = mutable.graph;

    const toDelete = new Set(this.graphAssets.keys());

    Object.entries(assets).forEach(([path, asset]) => {
      this.graphAssets.set(path, asset);
      toDelete.delete(path);
    });

    [...toDelete.values()].forEach((path) => {
      this.graphAssets.delete(path);
    });
  }
}

function err($error: string) {
  return { $error };
}
