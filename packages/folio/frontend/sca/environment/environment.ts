/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EnvironmentFlags } from "./environment-flags.js";

export { createEnvironment, type AppEnvironment };

/**
 * The Environment layer for Folio.
 * Reduced to the bare minimum: just flags.
 */
interface AppEnvironment {
  readonly flags: EnvironmentFlags;
  readonly isHydrated: Promise<number>;
}

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
