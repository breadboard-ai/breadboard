/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlags } from "@breadboard-ai/types";
import { createContext } from "@lit/context";

export type ClientDeploymentConfiguration = {
  MEASUREMENT_ID?: string;
  BACKEND_API_ENDPOINT?: string;
  ENABLE_GOOGLE_DRIVE_PROXY?: boolean;
  FEEDBACK_LINK?: string;
  ENABLE_GOOGLE_FEEDBACK?: boolean;
  GOOGLE_FEEDBACK_PRODUCT_ID?: string;
  GOOGLE_FEEDBACK_BUCKET?: string;
  flags: RuntimeFlags;
};

/**
 * These are the default values for runtime flags, necessary
 * for type-checking and ensuring that we have all the runtime flags
 * accounted for.
 * When adding a new flag, set the default value to false.
 * Also add it in packages/types/src/flags.ts
 */
const DEFAULT_FLAG_VALUES: RuntimeFlags = {
  usePlanRunner: false,
};

export function populateFlags(
  config: Partial<ClientDeploymentConfiguration>
): ClientDeploymentConfiguration {
  return {
    ...config,
    flags: { ...DEFAULT_FLAG_VALUES, ...config?.flags },
  };
}

export const clientDeploymentConfigurationContext = createContext<
  ClientDeploymentConfiguration | undefined
>("ClientDeploymentConfiguration");

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
