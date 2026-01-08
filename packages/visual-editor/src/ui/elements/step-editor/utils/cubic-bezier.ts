/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculates an [x,y] pair of points from start to end via two control points.
 * Per the math, this is defined as:
 *
 * (1-t)³ * start + 3(1 - t)² * t * cp + 3(1 - t) * t² * cp + t³ * end.
 *
 * @see https://en.wikipedia.org/wiki/B%C3%A9zier_curve
 */
export function calculatePointsOnCubicBezierCurve(
  startX: number,
  startY: number,
  cp1X: number,
  cp1Y: number,
  cp2X: number,
  cp2Y: number,
  endX: number,
  endY: number,
  from: number,
  to: number,
  step: number
) {
  if (from > to || from < 0 || from > 1 || to < 0 || to > 1) {
    throw new Error(
      "from must be less than to, and both must be between 0 and 1"
    );
  }

  const points: DOMPoint[] = [];
  for (let t = from; t <= to; t += step) {
    points.push(
      new DOMPoint(
        (1 - t) ** 3 * startX +
          3 * (1 - t) ** 2 * t * cp1X +
          3 * (1 - t) * t ** 2 * cp2X +
          t ** 3 * endX,

        (1 - t) ** 3 * startY +
          3 * (1 - t) ** 2 * t * cp1Y +
          3 * (1 - t) * t ** 2 * cp2Y +
          t ** 3 * endY
      )
    );
  }
  return points;
}
