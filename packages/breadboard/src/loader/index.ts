/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Loader } from "./loader.js";
import { GraphLoader, GraphProvider } from "./types.js";
import { DefaultGraphProvider } from "./default.js";

export const createLoader = (
  graphProviders?: GraphProvider[],
  opts?: { disableDefaultLoader: boolean }
): GraphLoader => {
  const providers = [...(graphProviders ?? [])];
  if (!opts?.disableDefaultLoader) {
    providers.push(new DefaultGraphProvider());
  }
  return new Loader(providers);
};

export { SENTINEL_BASE_URL } from "./loader.js";
