/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export default StarRating;

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
}

/**
 * Star rating display — filled, half, and empty stars.
 *
 * Uses --cg-color-secondary for filled star colour. Theme-sensitive.
 */
function StarRating({ rating, max = 5, size = 18 }: StarRatingProps) {
  const stars: React.ReactNode[] = [];

  for (let i = 1; i <= max; i++) {
    let fill: string;
    if (rating >= i) {
      fill = "var(--cg-color-secondary, #c06b84)"; // Full star
    } else if (rating >= i - 0.5) {
      fill = "var(--cg-color-secondary-container, #fce4ec)"; // Half star
    } else {
      fill = "var(--cg-color-surface-container, #efece8)"; // Empty
    }

    stars.push(
      React.createElement(
        "svg",
        {
          key: i,
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          style: { display: "inline-block" },
        },
        React.createElement("path", {
          d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
          fill,
          stroke: "var(--cg-color-outline, #d0ccc7)",
          strokeWidth: "0.5",
        })
      )
    );
  }

  return React.createElement(
    "div",
    {
      style: {
        display: "inline-flex",
        gap: "2px",
        alignItems: "center",
      },
    },
    ...stars
  );
}
