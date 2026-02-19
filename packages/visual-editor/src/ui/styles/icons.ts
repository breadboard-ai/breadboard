/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

/**
 * CSS classes for Google Symbols.
 *
 * Usage:
 *
 * ```html
 * <span class="g-icon">pen_spark</span>
 * ```
 *
 * Each variation axis is exposed as a CSS custom property so consumers
 * can toggle individual axes without repeating the full longhand:
 *
 * ```css
 * .my-button:hover .g-icon { --icon-fill: 1; }
 * ```
 */
export const icons = css`
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

    --icon-fill: 0;
    --icon-wght: 300;
    --icon-grad: 0;
    --icon-opsz: 48;
    --icon-rond: 100;

    font-variation-settings:
      "FILL" var(--icon-fill),
      "wght" var(--icon-wght),
      "GRAD" var(--icon-grad),
      "opsz" var(--icon-opsz),
      "ROND" var(--icon-rond);

    &.filled {
      --icon-fill: 1;
    }

    &.heavy {
      --icon-wght: 700;
    }

    &.round {
      --icon-rond: 100;
    }

    & > svg {
      width: 1em;
      height: 1em;
      fill: currentColor;
    }
  }
`;
