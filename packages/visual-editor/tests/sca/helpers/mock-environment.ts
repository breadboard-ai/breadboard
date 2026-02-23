/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlags } from "@breadboard-ai/types";
import { EnvironmentFlags } from "../../../src/sca/environment/environment-flags.js";
import type { AppEnvironment } from "../../../src/sca/environment/environment.js";

export { createMockEnvironment };

let mockEnvId = 0;

/**
 * Creates a minimal mock Environment for testing. Only `flags` is real
 * (an actual `EnvironmentFlags` instance); everything else is stubbed
 * to satisfy the type without requiring DOM or network dependencies.
 */
function createMockEnvironment(flags: RuntimeFlags): AppEnvironment {
  mockEnvId++;
  const envFlags = new EnvironmentFlags(
    flags,
    `MockEnv_Flags_${mockEnvId}`,
    `MockEnv_Persist_${mockEnvId}`
  );

  return {
    flags: envFlags,
    hostOrigin: new URL("http://localhost:3100"),
    environmentName: undefined,
    buildInfo: { packageJsonVersion: "0.0.0-test", gitCommitHash: "test" },
    googleDrive: {
      apiEndpoint: undefined,
      publishPermissions: [],
    },
    domains: undefined,
    deploymentConfig: {} as AppEnvironment["deploymentConfig"],
    shellHost: {} as AppEnvironment["shellHost"],
    guestConfig: {} as AppEnvironment["guestConfig"],
    get isHydrated() {
      return envFlags.isHydrated;
    },
  };
}
