/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const behavior = css`
  .behavior-hover:not([disabled]) {
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

    &:hover,
    &:focus {
      opacity: 1;
    }
  }
}` as CSSResultGroup;
