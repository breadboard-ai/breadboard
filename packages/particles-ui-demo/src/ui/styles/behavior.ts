/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";

const opacityBehavior = unsafeCSS(`
  &:not([disabled]) {
    cursor: pointer;
    opacity: var(--opacity, 0);
    transition: opacity var(--speed, 0.2s) cubic-bezier(0, 0, 0.3, 1);

    &:hover,
    &:focus {
      opacity: 1;
    }
  }`);

export const behavior = css`
  .behavior-ho-80 {
    --opacity: 0.8;
    ${opacityBehavior}
  }
}` as CSSResultGroup;
