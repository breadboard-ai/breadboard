/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner } from "../runner.js";

export type ProxyServerConfig = {
  board: BoardRunner;
};

export const defineConfig = (config: ProxyServerConfig) => config;
