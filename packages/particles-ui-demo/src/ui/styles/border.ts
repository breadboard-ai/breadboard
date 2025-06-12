/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";

export const border = css`
  ${unsafeCSS(
    new Array(13)
      .fill(0)
      .map((_, idx) => {
        return `
        .border-width-${idx} { border-width: ${idx}px; }
        .outline-width-${idx} { outline-width: ${idx}px; }`;
      })
      .join("\n")
  )}

  .border-style-solid {
    border-style: solid;
  }
` as CSSResultGroup;
