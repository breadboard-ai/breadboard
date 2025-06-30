/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Loader } from "./loader.js";
import { GraphLoader, BoardServer } from "@breadboard-ai/types";
import { DefaultBoardServer } from "./default.js";

export const createLoader = (
  boardServers?: BoardServer[],
  opts?: { disableDefaultProvider?: boolean }
): GraphLoader => {
  const servers = [...(boardServers ?? [])];
  if (!opts?.disableDefaultProvider) {
    servers.push(new DefaultBoardServer());
  }
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

export { loadWithFetch } from "./default.js";
