/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const outlineButtonWithIcon = css`
  .bb-outline-button-with-icon {
    background: var(--bb-icon, var(--bb-icon-help)) 16px center / 20px 20px
      no-repeat;
    border: 1px solid currentColor;
    border-radius: 100px;
    padding: 10px 24px 10px 42px;
    font-size: 16px;

    &:not([disabled]) {
      cursor: pointer;
      transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

      &:focus,
      &:hover {
        filter: brightness(0.8);
      }
    }
  }
`;
