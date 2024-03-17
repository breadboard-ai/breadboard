/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphLoader, GraphProvider } from "./types.js";

export const createLoader = (graphProviders?: GraphProvider[]): GraphLoader => {
  return {
    load: async (url) => {
      if (!graphProviders) {
        return null;
      }
      for (const provider of graphProviders) {
        if (provider.canHandle(url)) {
          return await provider.load(url);
        }
      }
      return null;
    },
  };
};
