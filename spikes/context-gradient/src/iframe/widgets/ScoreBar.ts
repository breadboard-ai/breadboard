/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export default ScoreBar;

interface ScoreBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}

/**
 * Horizontal bar visualization for scores.
 *
 * Uses --cg-color-tertiary for the fill (teal) and
 * --cg-color-surface-container for the track. Theme-sensitive.
 */
function ScoreBar({
  value,
  max = 10,
  label,
  showValue = true,
}: ScoreBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--cg-sp-3, 12px)",
        fontSize: "var(--cg-text-body-sm-size, 12px)",
        color: "var(--cg-color-on-surface, #1c1b1a)",
      },
    },
    label &&
      React.createElement(
        "span",
        {
          style: {
            minWidth: "80px",
            color: "var(--cg-color-on-surface-muted, #7a7672)",
          },
        },
        label
      ),
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          height: "6px",
          borderRadius: "var(--cg-radius-full, 999px)",
          background: "var(--cg-color-surface-container, #efece8)",
          overflow: "hidden",
        },
      },
      React.createElement("div", {
        style: {
          width: `${pct}%`,
          height: "100%",
          borderRadius: "var(--cg-radius-full, 999px)",
          background: "var(--cg-color-tertiary, #2d8a8a)",
          transition: "width 0.4s ease-out",
        },
      })
    ),
    showValue &&
      React.createElement(
        "span",
        {
          style: {
            minWidth: "32px",
            textAlign: "right" as const,
            fontWeight: "600",
          },
        },
        `${value}/${max}`
      )
  );
}
