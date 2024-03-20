/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Loader } from "./loader.js";
import { GraphLoader, GraphProvider } from "./types.js";

export const createLoader = (graphProviders?: GraphProvider[]): GraphLoader => {
  return new Loader(graphProviders ?? []);
};

export { SENTINEL_BASE_URL } from "./loader.js";
