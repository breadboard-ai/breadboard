/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type ValidColorStrings = `#${string}` | `--${string}`;

export function getGlobalColor(
  name: ValidColorStrings,
  defaultValue: ValidColorStrings = "#333333"
) {
  const documentStyles = getComputedStyle(document.documentElement);
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  const valueAsNumber = parseInt(value || defaultValue, 16);
  if (Number.isNaN(valueAsNumber)) {
    return `#${(0xff00ff).toString(16)}`;
  }
  return `#${valueAsNumber.toString(16).padStart(6, "0")}`;
}
