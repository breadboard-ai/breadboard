/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const icons = css`
  .m-icon {
    font-family: "Material Symbols Outlined";
    font-weight: normal;
    font-style: normal;
    font-size: 20px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
  }

  .m-icon {
    font-variation-settings:
      "FILL" 0,
      "wght" 300,
      "GRAD" 0,
      "opsz" 48;

    &.filled {
      font-variation-settings:
        "FILL" 1,
        "wght" 300,
        "GRAD" 0,
        "opsz" 48;
    }
  }
`;
