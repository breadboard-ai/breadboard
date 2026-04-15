/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EnvironmentFlags } from "./environment-flags.js";
import type { AppEnvironment } from "../types.js";

export { createEnvironment };

function createEnvironment(
  flags: Record<string, boolean> = {}
): Readonly<AppEnvironment> {
  const envFlags = new EnvironmentFlags(flags);

  return {
    flags: envFlags,
    get isHydrated() {
      return envFlags.isHydrated;
    },
  };
}
