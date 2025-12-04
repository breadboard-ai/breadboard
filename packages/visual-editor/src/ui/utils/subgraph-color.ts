/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { hash } from "@google-labs/breadboard";

const borderPresets = [
  0xef9a9a, 0xf48fb1, 0xce93d8, 0xb39ddb, 0x9fa8da, 0x90caf9, 0x81d4fa,
  0x80deea, 0x80cbc4, 0xa5d6a7, 0xc5e1a5, 0xe6ee9c, 0xffcc80, 0xffab91,
];

const labelPresets = [
  0xf44336, 0xe91e63, 0x9c27b0, 0x673ab7, 0x3f51b5, 0x2196f3, 0x03a9f4,
  0x00bcd4, 0x009688, 0x4caf50, 0x8bc34a, 0xcddc39, 0xff9800, 0xff5722,
];

const textPresets = [
  0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff,
  0xffffff, 0xffffff, 0xffffff, 0xffffff, 0x000000, 0x000000, 0xffffff,
];

export function getSubItemColor<T extends string | number>(
  id: string,
  type: "border" | "label" | "text",
  asNumber = false
): T {
  let colorSet = textPresets;
  if (type === "border") colorSet = borderPresets;
  if (type === "label") colorSet = labelPresets;

  const hashedValue = hash(id);
  const idx = hashedValue % colorSet.length;
  if (asNumber) {
    return colorSet[idx] as T;
  }

  const colString = colorSet[idx].toString(16);
  return `#${colString.padStart(6, "0")}` as T;
}
