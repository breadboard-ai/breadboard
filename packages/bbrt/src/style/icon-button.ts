/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const iconButtonStyle = css`
  .bb-icon-button {
    width: 32px;
    height: 32px;
    background: var(--bb-neutral-50) var(--bb-icon) center center / 20px 20px
      no-repeat;
    border-radius: var(--bb-grid-size);
    border: 1px solid var(--bb-neutral-300);
    font-size: 0;
    flex: 0 0 auto;
    margin-left: var(--bb-grid-size);
    cursor: pointer;
  }

  .bb-icon-button:hover,
  .bb-icon-button:focus {
    background-color: var(--bb-neutral-300);
  }
`;
