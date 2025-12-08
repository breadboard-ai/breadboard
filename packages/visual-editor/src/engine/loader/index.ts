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
