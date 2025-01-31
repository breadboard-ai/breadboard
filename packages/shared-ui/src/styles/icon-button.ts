/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const iconButtonStyles = css`
  .bb-icon-button {
    background: var(--bb-icon, var(--bb-icon-help)) center center / 20px 20px
      no-repeat;
    width: 24px;
    height: 24px;
    border: none;
    font-size: 0;
    opacity: 0.3;
    width: var(--bb-grid-size-8);

    &:not([disabled]) {
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

      &:focus,
      &:hover {
        opacity: 1;
      }
    }
  }
`;
