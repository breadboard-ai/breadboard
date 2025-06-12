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
    font-family: var(--font-family, var(--default-font-family));
    font-optical-sizing: auto;
    font-style: normal;
    font-weight: 400;
    font-variation-settings: "GRAD" 0;
  }

  .sans-flex {
    font-family: var(--font-family-flex, var(--default-font-family));
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
    font-family: var(--font-family-mono, var(--default-font-family));
    font-optical-sizing: auto;
    font-weight: 400;
    font-style: normal;
  }

  /** Material Design **/

  .label-small {
    font-size: 11px;
    line-height: 16px;
  }

  .label-medium {
    font-size: 12px;
    line-height: 16px;
  }

  .label-large {
    font-size: 14px;
    line-height: 20px;
  }

  .body-small {
    font-size: 12px;
    line-height: 16px;
  }

  .body-medium {
    font-size: 14px;
    line-height: 20px;
  }

  .body-large {
    font-size: 16px;
    line-height: 24px;
  }

  .title-small {
    font-size: 14px;
    line-height: 20px;
  }

  .title-medium {
    font-size: 16px;
    line-height: 24px;
  }

  .title-large {
    font-size: 22px;
    line-height: 28px;
  }

  .headline-small {
    font-size: 24px;
    line-height: 32px;
  }

  .headline-medium {
    font-size: 28px;
    line-height: 36px;
  }

  .headline-large {
    font-size: 32px;
    line-height: 40px;
  }

  .display-small {
    font-size: 36px;
    line-height: 44px;
  }

  .display-medium {
    font-size: 45px;
    line-height: 52px;
  }

  .display-large {
    font-size: 57px;
    line-height: 64px;
  }

  /** Weights **/

  .w-500 {
    font-weight: 500;
  }

  .w-400 {
    font-weight: 400;
  }
` as CSSResultGroup;
