/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Entity } from "../entity";

export function calculateBounds(
  entities: Map<string, Entity>,
  adjustment?: DOMPoint
) {
  const bounds = new DOMRect(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY
  );

  for (const entity of entities.values()) {
    const newLeft = entity.transform.e;
    const newTop = entity.transform.f;
    const newRight = entity.transform.e + entity.bounds.width;
    const newBottom = entity.transform.f + entity.bounds.height;

    const left = Number.isFinite(bounds.left)
      ? Math.min(bounds.left, newLeft)
      : Math.min(Number.POSITIVE_INFINITY, newLeft);
    const right = Number.isFinite(bounds.right)
      ? Math.max(bounds.right, newRight)
      : Math.min(Number.POSITIVE_INFINITY, newRight);
    const top = Number.isFinite(bounds.top)
      ? Math.min(bounds.top, newTop)
      : Math.min(Number.POSITIVE_INFINITY, newTop);
    const bottom = Number.isFinite(bounds.bottom)
      ? Math.max(bounds.bottom, newBottom)
      : Math.min(Number.POSITIVE_INFINITY, newBottom);

    bounds.width = right - left;
    bounds.height = bottom - top;
    bounds.x = left;
    bounds.y = top;

    if (adjustment) {
      adjustment.x = Math.min(adjustment.x, entity.transform.e);
      adjustment.y = Math.min(adjustment.y, entity.transform.f);
    }
  }

  if (Number.isNaN(bounds.left)) {
    return new DOMRect();
  }

  return bounds;
}
