/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";

const ASSET_LIST = new Map([
  ["code-blocks", "/third_party/icons/graph/code-blocks-48px.svg"],
  [
    "drag-click-inverted",
    "/third_party/icons/graph/drag-click-inverted-48px.svg",
  ],
  ["edit", "/third_party/icons/graph/edit-48px.svg"],
  ["fetch", "/third_party/icons/graph/fetch-48px.svg"],
  ["google-drive", "/third_party/icons/graph/google-drive-48px.svg"],
  ["human", "/third_party/icons/graph/human-48px.svg"],
  ["input", "/third_party/icons/graph/input-48px.svg"],
  ["jsonata", "/third_party/icons/graph/jsonata-48px.svg"],
  ["laps", "/third_party/icons/graph/laps-48px.svg"],
  ["joiner", "/third_party/icons/graph/merge-type-48px.svg"],
  ["nano", "/third_party/icons/graph/nano-48px.svg"],
  ["output", "/third_party/icons/graph/output-48px.svg"],
  ["play-filled", "/third_party/icons/graph/play-filled-48px.svg"],
  ["runJavascript", "/third_party/icons/graph/js-48px.svg"],
  ["runModule", "/third_party/icons/graph/extension-48px.svg"],
  ["secrets", "/third_party/icons/graph/secrets-48px.svg"],
  ["smart-toy", "/third_party/icons/graph/smart-toy-48px.svg"],
  ["urlTemplate", "/third_party/icons/graph/http-48px.svg"],
  ["value", "/third_party/icons/graph/value-48px.svg"],
]);

type AssetMap = Map<string, PIXI.Texture>;

export class GraphAssets {
  static assetPrefix = "~";
  static #instance: GraphAssets;
  static instance() {
    if (!this.#instance) {
      this.#instance = new GraphAssets();
    }
    return this.#instance;
  }

  #assets: AssetMap = new Map();
  #loaded: Promise<void> = Promise.resolve();

  loadAssets(assetPrefix: string) {
    GraphAssets.assetPrefix = assetPrefix;
    const loadedAssets = [...ASSET_LIST.entries()].map(
      async ([name, path]): Promise<[string, PIXI.Texture | null]> => {
        try {
          const texture = await PIXI.Assets.load<PIXI.Texture>(
            `${GraphAssets.assetPrefix}${path}`
          );
          return [name, texture];
        } catch (e) {
          return [name, null];
        }
      }
    );

    this.#loaded = Promise.all(loadedAssets).then((vals) => {
      this.#assets = new Map(
        vals.filter((v) => v[1] !== null) as [string, PIXI.Texture][]
      );
    });
  }

  // Not to be instantiated directly.
  private constructor() {}

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
