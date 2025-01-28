/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, AssetPath } from "@breadboard-ai/types";
import {
  EditableGraph,
  EditSpec,
  GraphStoreEntry,
  MainGraphIdentifier,
  MutableGraphStore,
  Outcome,
} from "@google-labs/breadboard";
import { SignalMap } from "signal-utils/map";
import { ReactiveOrganizer } from "./organizer";
import { AtMenu, Organizer, Project, ProjectInternal, Tool } from "./types";

export { ReactiveProject, createProjectState };

/**
 * Controls the filter for tools. Use it to tweak what shows up in the "Tools"
 * section of the "@" menu.
 */
function isTool(entry: GraphStoreEntry) {
  return entry.tags?.includes("tool") && !!entry.url;
}

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
  readonly tools: SignalMap<string, Tool>;
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
      this.#updateTools();
    });
    this.graphAssets = new SignalMap();
    this.tools = new SignalMap();
    this.organizer = new ReactiveOrganizer(this);
    this.atMenu = {
      graphAssets: this.graphAssets,
      generatedAssets: [],
      tools: this.tools,
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

  #updateTools() {
    const graphs = this.#store.graphs();
    const tools = graphs.filter(isTool).map((entry) => [
      entry.url!,
      {
        url: entry.url!,
        title: entry.title,
        description: entry.description,
      },
    ]) as [string, Tool][];
    updateMap(this.tools, tools);
  }

  #updateGraphAssets() {
    const mutable = this.#store.get(this.#mainGraphId);
    if (!mutable) return;

    const { assets = {} } = mutable.graph;

    updateMap(this.graphAssets, Object.entries(assets));
  }
}

function err($error: string) {
  return { $error };
}

/**
 * Incrementally updates a map, given updated values.
 * Updates the values in `updated`, deletes the ones that aren't in it.
 */
function updateMap<T extends SignalMap>(
  map: T,
  updated: [string, unknown][]
): void {
  const toDelete = new Set(map.keys());

  updated.forEach(([key, value]) => {
    map.set(key, value);
    toDelete.delete(key);
  });

  [...toDelete.values()].forEach((key) => {
    map.delete(key);
  });
}
