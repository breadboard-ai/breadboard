/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const fabStyles = css`
  .bb-fab {
    background: var(--background-color, var(--bb-ui-500))
      var(--bb-icon, var(--bb-icon-help)) center center /
      var(--background-size, 20px) var(--background-size, 20px) no-repeat;
    width: var(--bb-grid-size-9);
    aspect-ratio: 1;
    box-shadow: var(--box-shadow, var(--bb-elevation-1));
    border-radius: var(--border-radius, var(--bb-grid-size-16));
    border: none;
    font-size: 0;
    padding: 0;

    &:not([disabled]) {
      cursor: pointer;
      transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

      &:focus,
      &:hover {
        background-color: var(--background-color-active, var(--bb-ui-700));
      }
    }
  }
`;
