/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Loader } from "./loader.js";
import { GraphLoader, BoardServer } from "@breadboard-ai/types";

export const createLoader = (boardServers?: BoardServer[]): GraphLoader => {
  const servers = [...(boardServers ?? [])];
  return new Loader(servers);
};

export {
  SENTINEL_BASE_URL,
  baseURLFromContext,
  resolveGraph,
  getGraphUrl,
  baseURLFromString,
  urlComponentsFromString,
} from "./loader.js";
export { resolveGraphUrls } from "./resolve-graph-urls.js";

export {
  resolveBoardCapabilitiesInInputs,
  resolveBoardCapabilities,
  getGraphDescriptor,
} from "./capability.js";
