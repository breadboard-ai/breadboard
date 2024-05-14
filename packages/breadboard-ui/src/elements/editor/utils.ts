/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const documentStyles = getComputedStyle(document.documentElement);

export function getGlobalColor(name: string, defaultValue = "#333333") {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  return parseInt(value || defaultValue, 16);
}
