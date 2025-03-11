/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const documentStyles = getComputedStyle(document.documentElement);

type ValidColorStrings = `#${string}` | `--${string}`;

export function getGlobalColor(
  name: ValidColorStrings,
  defaultValue: ValidColorStrings = "#333333"
) {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  const valueAsNumber = parseInt(value || defaultValue, 16);
  if (Number.isNaN(valueAsNumber)) {
    return `#${(0xff00ff).toString(16)}`;
  }
  return `#${valueAsNumber.toString(16).padStart(6, "0")}`;
}

/**
 * Based on https://www.w3.org/TR/AERT/#color-contrast
 *
 * @param hexColor
 * @returns
 */
export function getThemeModeFromBackground(hexColor: string): "light" | "dark" {
  try {
    if (!/^#[0-9a-f]{6}$/.test(hexColor.toLowerCase())) {
      throw new Error("Invalid color");
    }

    hexColor = hexColor.slice(1);

    const r = Number.parseInt(hexColor.slice(0, 2), 16);
    const g = Number.parseInt(hexColor.slice(2, 4), 16);
    const b = Number.parseInt(hexColor.slice(4, 6), 16);

    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    return luma > 128 ? "light" : "dark";
  } catch (err) {
    return "light";
  }
}
