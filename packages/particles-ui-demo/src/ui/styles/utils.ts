/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
