/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const toolbarStyles = css`
  .bb-toolbar {
    background: var(--bb-neutral-0);
    border-radius: var(--bb-grid-size-16);
    border: 1px solid var(--bb-neutral-300);
    display: flex;
    height: var(--bb-grid-size-8);
    padding: 0 var(--bb-grid-size-2);

    & button {
      background: var(--bb-icon, var(--bb-icon-help)) center center / 20px 20px
        no-repeat;
      border: none;
      font-size: 0;
      height: 100%;
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

    & .bb-divider {
      background: var(--bb-neutral-100);
      margin: 0 var(--bb-grid-size-2);
      width: 1px;
    }
  }
`;
