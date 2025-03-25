/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function intersects(a: DOMRect | null, b: DOMRect | null, padding = 0) {
  if (!a || !b) {
    return false;
  }

  const aIsAboveB = a.bottom < b.top - padding;
  const aIsBelowB = a.top > b.bottom + padding;
  const aIsToTheLeft = a.right < b.left - padding;
  const aIsToTheRight = a.left > b.right + padding;

  return !(aIsAboveB || aIsBelowB || aIsToTheLeft || aIsToTheRight);
}
