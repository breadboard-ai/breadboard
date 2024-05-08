/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";

const ASSET_LIST = new Map([
  ["smart-toy", "/third_party/icons/smart-toy.svg"],
  ["human", "/third_party/icons/human.svg"],
  ["laps", "/third_party/icons/laps.svg"],
]);

type AssetMap = Map<string, PIXI.Texture>;

export class GraphAssets {
  static #instance: GraphAssets;
  static instance() {
    if (!this.#instance) {
      this.#instance = new GraphAssets();
    }
    return this.#instance;
  }

  #assets!: AssetMap;
  #loaded: Promise<void>;

  // Not to be instantiated directly.
  private constructor() {
    const loadedAssets = [...ASSET_LIST.entries()].map(
      async ([name, path]): Promise<[string, PIXI.Texture]> => {
        const texture = await PIXI.Assets.load<PIXI.Texture>(path);
        return [name, texture];
      }
    );

    this.#loaded = Promise.all(loadedAssets).then((vals) => {
      this.#assets = new Map(vals);
    });
  }

  get loaded() {
    return this.#loaded;
  }

  get(name: string) {
    return this.#assets.get(name) || null;
  }

  has(name: string) {
    return this.#assets.has(name);
  }
}
