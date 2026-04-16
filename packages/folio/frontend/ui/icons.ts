/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

/**
 * Shared g-icon CSS for Google Symbols usage.
 */
export const icons = css`
  .g-icon {
    font-family: "Google Symbols";
    font-weight: normal;
    font-style: normal;
    font-display: optional;
    font-size: var(--g-icon-font-size, 20px);
    width: var(--g-icon-width, 1em);
    height: var(--g-icon-height, 1em);
    user-select: none;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: var(--g-icon-display, inline-block);
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
    overflow: hidden;

    --icon-fill: 0;
    --icon-wght: 300;
    --icon-grad: 0;
    --icon-opsz: 48;
    --icon-rond: 0;

    font-variation-settings:
      "FILL" var(--icon-fill),
      "wght" var(--icon-wght),
      "GRAD" var(--icon-grad),
      "opsz" var(--icon-opsz),
      "ROND" var(--icon-rond);

    &.filled {
      --icon-fill: 1;
    }

    &.round {
      --icon-rond: 100;
    }

    &.heavy {
      --icon-wght: 700;
    }

    & > svg {
      width: 1em;
      height: 1em;
      fill: currentColor;
    }
  }
`;
