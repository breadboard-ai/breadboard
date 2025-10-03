/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const fonts = css`
  .g-icon {
    font-family: "Google Symbols";
    font-weight: normal;
    font-style: normal;
    font-display: optional;
    font-size: 20px;
    width: 1em;
    height: 1em;
    user-select: none;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
    overflow: hidden;

    font-variation-settings:
      "FILL" 0,
      "wght" 300,
      "GRAD" 0,
      "opsz" 48,
      "ROND" 100;

    &.filled {
      font-variation-settings:
        "FILL" 1,
        "wght" 300,
        "GRAD" 0,
        "opsz" 48,
        "ROND" 100;
    }

    &.filled-heavy {
      font-variation-settings:
        "FILL" 1,
        "wght" 700,
        "GRAD" 0,
        "opsz" 48,
        "ROND" 100;
    }
  }

  .sans {
    font-family: var(--bb-font-family, var(--default-font-family));
    font-optical-sizing: auto;
    font-style: normal;
    font-weight: 400;
    font-variation-settings: "GRAD" 0;
  }

  .sans-flex {
    font-family: var(--bb-font-family-flex, var(--default-font-family));
    font-optical-sizing: auto;
    font-style: normal;
    font-weight: 400;
    font-variation-settings:
      "slnt" 0,
      "wdth" 100,
      "GRAD" 0;
  }

  .round {
    font-variation-settings:
      "slnt" 0,
      "wdth" 100,
      "GRAD" 0,
      "ROND" 100;
  }
`;
