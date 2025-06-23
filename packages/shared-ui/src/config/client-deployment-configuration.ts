/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";

export type ClientDeploymentConfiguration = {
  MEASUREMENT_ID?: string;
  BACKEND_API_ENDPOINT?: string;
  ENABLE_GOOGLE_DRIVE_PROXY?: boolean;
  FEEDBACK_LINK?: string;
};

export const clientDeploymentConfigurationContext = createContext(
  "ClientDeploymentConfiguration"
);

export function discoverClientDeploymentConfiguration(): ClientDeploymentConfiguration {
  // Fish out the configuration from DOM, which the server is responsible for
  // including in the main HTML file.
  const text =
    document.querySelector("template")?.content?.firstElementChild?.textContent;
  if (!text) {
    console.warn(
      "Failed to discover deployment config: DOM element not found."
    );
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("Failed to discover deployment config:", (e as Error).message);
    return {};
  }
}
