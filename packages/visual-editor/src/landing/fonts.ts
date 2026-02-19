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
