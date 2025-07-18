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

  /** Material Design **/

  .md-display-large {
    font-size: 57px;
    line-height: 64px;
  }

  .md-display-medium {
    font-size: 45px;
    line-height: 52px;
  }

  .md-display-small {
    font-size: 36px;
    line-height: 44px;
  }

  .md-headline-large {
    font-size: 32px;
    line-height: 40px;
  }

  .md-headline-medium {
    font-size: 28px;
    line-height: 36px;
  }

  .md-headline-small {
    font-size: 24px;
    line-height: 32px;
  }

  .md-title-large {
    font-size: 22px;
    line-height: 28px;
  }

  .md-title-medium {
    font-size: 16px;
    line-height: 24px;
  }

  .md-title-small {
    font-size: 14px;
    line-height: 20px;
  }

  .md-body-large {
    font-size: 16px;
    line-height: 24px;
  }

  .md-body-medium {
    font-size: 14px;
    line-height: 20px;
  }

  .md-body-small {
    font-size: 12px;
    line-height: 16px;
  }

  .md-label-large {
    font-size: 14px;
    line-height: 20px;
  }

  .md-label-medium {
    font-size: 12px;
    line-height: 16px;
  }

  .md-label-small {
    font-size: 11px;
    line-height: 16px;
  }

  /** Weights **/

  .w-700 {
    font-weight: 700;
  }

  .w-500 {
    font-weight: 500;
  }

  .w-400 {
    font-weight: 400;
  }
` as CSSResultGroup;
