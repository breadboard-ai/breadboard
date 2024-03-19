/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RunConfig } from "./run.js";
import { ServeConfig } from "./serve.js";

export const baseURL = (config: RunConfig | ServeConfig) => {
  if (config.base) return config.base;
  if ("window" in globalThis) return new URL(self.location.href);
  return new URL(import.meta.url);
};
