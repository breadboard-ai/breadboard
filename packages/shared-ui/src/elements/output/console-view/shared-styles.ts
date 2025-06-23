/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";
import { colorsLight } from "../../../styles/host/colors-light";

export const sharedStyles = [
  colorsLight,
  css`
    .output {
      position: relative;
      margin-top: var(--bb-grid-size-9);
      border-radius: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      border: 1px solid var(--bb-neutral-200);
      color: var(--bb-neutral-900);
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
        color: var(--n-40);
      }

      &::before {
        content: attr(data-label);
        position: absolute;
        left: var(--bb-grid-size-3);
        top: calc(-1px - var(--bb-grid-size-5));
        color: var(--n-40);
      }

      &:has(.g-icon)::before {
        left: calc(28px + var(--bb-grid-size-3));
      }

      & p {
        margin: 0;
      }
    }
  `,
] as CSSResultGroup;
