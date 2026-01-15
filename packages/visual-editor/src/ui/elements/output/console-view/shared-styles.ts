/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const sharedStyles = [
  css`
    .output,
    .step-error {
      position: relative;
      margin-top: var(--bb-grid-size-9);
      border-radius: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      border: 1px solid var(--light-dark-n-90);
      color: var(--light-dark-n-10);
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      > * {
        max-width: 800px;
        width: 100%;

        &:last-of-type {
          margin-bottom: 0;
        }
      }

      & .g-icon:not(.inline) {
        position: absolute;
        left: var(--bb-grid-size-3);
        top: calc(-4px - var(--bb-grid-size-5));
        color: var(--light-dark-n-40);
      }

      &::before {
        content: attr(data-label);
        position: absolute;
        left: var(--bb-grid-size-3);
        top: calc(-1px - var(--bb-grid-size-5));
        color: var(--light-dark-n-40);
      }

      &:has(.g-icon)::before {
        left: calc(28px + var(--bb-grid-size-3));
      }

      & p {
        margin: 0;
      }
    }

    .step-error {
      border-color: var(--light-dark-e-50);
    }
  `,
] as CSSResultGroup;
