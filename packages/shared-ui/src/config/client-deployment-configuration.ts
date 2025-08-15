/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type RuntimeFlags } from "@breadboard-ai/types";
import { type ClientDeploymentConfiguration } from "@breadboard-ai/types/deployment-configuration.js";

/**
 * These are the default values for runtime flags, necessary
 * for type-checking and ensuring that we have all the runtime flags
 * accounted for.
 * When adding a new flag, set the default value to false.
 * Also add it in packages/types/src/flags.ts
 */
const DEFAULT_FLAG_VALUES: RuntimeFlags = {
  usePlanRunner: false,
  saveAsCode: false,
  generateForEach: false,
  mcp: false,
  force2DGraph: false,
};

export function populateFlags(
  config: Partial<ClientDeploymentConfiguration>
): ClientDeploymentConfiguration {
  return {
    ...config,
    flags: { ...DEFAULT_FLAG_VALUES, ...config?.flags },
  };
}

export function discoverClientDeploymentConfiguration(): ClientDeploymentConfiguration {
  // Fish out the configuration from DOM, which the server is responsible for
  // including in the main HTML file.
  const text =
    document.querySelector("template")?.content?.firstElementChild?.textContent;
  if (!text) {
    console.warn(
      "Failed to discover deployment config: DOM element not found."
    );
    return populateFlags({});
  }
  try {
    return populateFlags(JSON.parse(text));
  } catch (e) {
    console.warn("Failed to discover deployment config:", (e as Error).message);
    return populateFlags({});
  }
}
