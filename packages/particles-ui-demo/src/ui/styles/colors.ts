/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";

export const neutral = {
  n100: "#ffffff",
  n99: "#fcfcfc",
  n98: "#f9f9f9",
  n95: "#f1f1f1",
  n90: "#e2e2e2",
  n80: "#c6c6c6",
  n70: "#ababab",
  n60: "#919191",
  n50: "#777777",
  n40: "#5e5e5e",
  n35: "#525252",
  n30: "#474747",
  n25: "#3b3b3b",
  n20: "#303030",
  n15: "#262626",
  n10: "#1b1b1b",
  n5: "#111111",
  n0: "#000000",
};

export const colors = css`
  :host {
    ${unsafeCSS(
      Object.entries(neutral)
        .map(([key, val]) => {
          return `--${key[0]}-${key.slice(1)}: ${val};`;
        })
        .join("\n")
    )}
  }

  ${unsafeCSS(
    Object.entries(neutral)
      .map(([key, val]) => {
        return `.color-bc-${key} { border-color: ${val}; }`;
      })
      .join("\n")
  )}

  ${unsafeCSS(
    Object.entries(neutral)
      .map(([key, val]) => {
        return `.color-bgc-${key} { background-color: ${val}; }`;
      })
      .join("\n")
  )}

  ${unsafeCSS(
    Object.entries(neutral)
      .map(([key, val]) => {
        return `.color-c-${key} { color: ${val}; }`;
      })
      .join("\n")
  )}
` as CSSResultGroup;
