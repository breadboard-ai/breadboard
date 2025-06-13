/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorPalettes } from "../../types/colors";

export function merge(...classes: Array<Record<string, boolean>>) {
  const styles: Record<string, boolean> = {};
  for (const clazz of classes) {
    for (const [key, val] of Object.entries(clazz)) {
      const prefix = key.split("-").with(-1, "").join("-");
      const existingKeys = Object.keys(styles).filter((key) =>
        key.startsWith(prefix)
      );

      for (const existingKey of existingKeys) {
        delete styles[existingKey];
      }

      styles[key] = val;
    }
  }

  return styles;
}

export function createThemeStyles(
  palettes: ColorPalettes
): Record<string, string> {
  const styles: Record<string, string> = {};
  for (const palette of Object.values(palettes)) {
    for (const [key, val] of Object.entries(palette)) {
      const prop = toProp(key);
      styles[prop] = val;
    }
  }

  return styles;
}

export function toProp(key: string) {
  if (key.startsWith("nv")) {
    return `--nv-${key.slice(2)}`;
  }

  return `--${key[0]}-${key.slice(1)}`;
}
