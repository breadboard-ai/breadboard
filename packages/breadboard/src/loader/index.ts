/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Loader } from "./loader.js";
import { GraphLoader, BoardServer } from "./types.js";
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

export { SENTINEL_BASE_URL, baseURLFromContext } from "./loader.js";
