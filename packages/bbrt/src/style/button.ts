/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const buttonStyle = css`
  .bb-button {
    background: var(--bb-neutral-50) var(--bb-icon) 12px center / 20px 20px
      no-repeat;
    border: 1px solid var(--bb-neutral-300);
    font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
      var(--bb-font-family);
    color: var(--bb-neutral-700);
    padding: var(--bb-grid-size-2) var(--bb-grid-size-6) var(--bb-grid-size-2)
      var(--bb-grid-size-10);
    border-radius: var(--bb-grid-size-12);
    display: flex;
    justify-content: flex-end;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
  }

  .bb-button:hover,
  .bb-button:focus {
    background-color: var(--bb-neutral-300);
  }
`;
