/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const fabStyles = css`
  .bb-fab {
    background: var(--bb-icon, var(--bb-icon-help)) center center / 20px 20px
      no-repeat;
    width: var(--bb-grid-size-9);
    aspect-ratio: 1;
    box-shadow: var(--bb-elevation-1);
    border-radius: var(--bb-grid-size-16);
    border: none;
    font-size: 0;

    &:not([disabled]) {
      cursor: pointer;
      transition: filter 0.2s cubic-bezier(0, 0, 0.3, 1);

      &:focus,
      &:hover {
        filter: brightness(1.2);
      }
    }
  }
`;
