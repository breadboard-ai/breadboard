/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Asset, AssetMetadata, AssetPath } from "@breadboard-ai/types";
import {
  EditSpec,
  MainGraphIdentifier,
  MutableGraphStore,
  Outcome,
} from "@google-labs/breadboard";
import { SignalMap } from "signal-utils/map";

export { ReactiveOrganizer };

export type Organizer = {
  /**
   * Current graph's assets.
   */
  assets: Map<AssetPath, Asset>;

  addAsset(path: AssetPath, asset: Asset): Promise<Outcome<void>>;
  removeAsset(path: AssetPath): Promise<Outcome<void>>;
  changeAssetMetadata(
    path: AssetPath,
    metadata: AssetMetadata
  ): Promise<Outcome<void>>;
};

class ReactiveOrganizer implements Organizer {
  #mainGraphId: MainGraphIdentifier;
  #store: MutableGraphStore;
  readonly assets: SignalMap<AssetPath, Asset>;

  constructor(mainGraphId: MainGraphIdentifier, store: MutableGraphStore) {
    this.#mainGraphId = mainGraphId;
    this.#store = store;
    store.addEventListener("update", (event) => {
      if (event.mainGraphId === mainGraphId) {
        this.#updateAssets();
      }
    });
    this.assets = new SignalMap();
    this.#updateAssets();
  }

  async #edit(spec: EditSpec[], label: string): Promise<Outcome<void>> {
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

  addAsset(path: AssetPath, asset: Asset): Promise<Outcome<void>> {
    const { data, metadata } = asset;
    return this.#edit(
      [{ type: "addasset", path, data, metadata }],
      `Adding asset at path "${path}"`
    );
  }

  removeAsset(path: AssetPath): Promise<Outcome<void>> {
    return this.#edit(
      [{ type: "removeasset", path }],
      `Removing asset at path "${path}"`
    );
  }

  changeAssetMetadata(
    path: AssetPath,
    metadata: AssetMetadata
  ): Promise<Outcome<void>> {
    return this.#edit(
      [{ type: "changeassetmetadata", path, metadata }],
      `Changing asset metadata at path "${path}"`
    );
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
