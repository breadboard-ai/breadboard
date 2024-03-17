/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import { DefaultGraphProvider } from "./default.js";
import { GraphLoader, GraphProvider } from "./types.js";

class Loader {
  #graphProviders?: GraphProvider[];

  constructor(graphProviders?: GraphProvider[]) {
    this.#graphProviders = [
      ...(graphProviders || []),
      new DefaultGraphProvider(),
    ];
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    if (!this.#graphProviders) {
      return null;
    }
    for (const provider of this.#graphProviders) {
      const capabilities = provider.canProvide(url);
      if (capabilities === false) {
        continue;
      }
      if (capabilities.load) {
        return await provider.load(url);
      }
    }
    return null;
  }
}

export const createLoader = (graphProviders?: GraphProvider[]): GraphLoader => {
  return new Loader(graphProviders);
};
