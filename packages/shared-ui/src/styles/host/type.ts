/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const type = css`
  :host {
    --default-font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    --default-font-family-mono: "Courier New", Courier, monospace;
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

  .code {
    font-family: var(--bb-font-family-mono, var(--default-font-family));
    font-optical-sizing: auto;
    font-weight: 400;
    font-style: normal;
  }

  /** Size **/

  /** Weights **/

  .w-500 {
    font-weight: 500;
  }

  .w-400 {
    font-weight: 400;
  }
` as CSSResultGroup;
