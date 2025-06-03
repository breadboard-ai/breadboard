/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { receiveConfig };

function receiveConfig() {
  // Fish out the configuration from DOM.
  const text = (
    document.querySelector("template") as HTMLTemplateElement
  ).content?.firstElementChild?.textContent?.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}
