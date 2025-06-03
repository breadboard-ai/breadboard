/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ClientDeploymentConfiguration } from "@breadboard-ai/visual-editor/bootstrap";

export { receiveConfig };

function receiveConfig(): ClientDeploymentConfiguration | undefined {
  // Fish out the configuration from DOM.
  const text = (
    document.querySelector("template") as HTMLTemplateElement
  ).content?.firstElementChild?.textContent?.trim();
  if (!text) {
    console.warn("Failed to receive deployment config: DOM element not found.");
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("Failed to receive deployment config:", (e as Error).message);
    return undefined;
  }
}
