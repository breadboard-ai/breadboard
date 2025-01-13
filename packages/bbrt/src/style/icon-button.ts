/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const iconButtonStyle = css`
  .bb-icon-button {
    --bb-icon-size: 20px;
    --bb-button-size: calc(var(--bb-icon-size) * 1.6);
    width: var(--bb-button-size);
    height: var(--bb-button-size);
    background: var(--bb-button-background, var(--bb-neutral-50)) var(--bb-icon)
      center center / var(--bb-icon-size) var(--bb-icon-size) no-repeat;
    border-radius: var(--bb-grid-size);
    border: 1px solid var(--bb-neutral-300);
    font-size: 0;
    flex: 0 0 auto;
    cursor: pointer;
  }

  .bb-icon-button:hover,
  .bb-icon-button:focus {
    background-color: var(--bb-button-background, var(--bb-neutral-300));
  }
`;
