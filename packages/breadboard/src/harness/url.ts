/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SENTINEL_BASE_URL } from "../loader/index.js";
import { RunConfig } from "./types.js";

export const baseURL = (config: RunConfig) => {
  if (config.base) return config.base;
  if ("window" in globalThis) return new URL(self.location.href);
  return SENTINEL_BASE_URL;
};
