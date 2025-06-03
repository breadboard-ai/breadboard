/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const buttonStyles = css`
  .bb-button-filled,
  .bb-button-outlined,
  .bb-button-text {
    color: var(--bb-neutral-700);
    border-radius: 100px;
    padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
    font-size: var(--bb-label-large);
    transition:
      background 0.2s cubic-bezier(0, 0, 0.3, 1),
      color 0.2s cubic-bezier(0, 0, 0.3, 1);
    display: flex;
    align-items: center;
    justify-content: center;

    &[disabled] {
      opacity: 75%;
    }
    &:not([disabled]) {
      cursor: pointer;
    }

    > .g-icon {
      margin-right: var(--bb-grid-size-2);
    }
  }

  .bb-button-filled {
    border: none;
    background: var(--bb-neutral-300);

    &:not([disabled]) {
      &:focus,
      &:hover {
        background: var(--bb-button-hover-background, var(--bb-neutral-100));
      }
    }
  }

  .bb-button-outlined {
    border: 1px solid currentColor;
    background: transparent;

    &:not([disabled]) {
      &:focus,
      &:hover {
        background: var(
          --bb-button-hover-background,
          color-mix(in srgb, currentColor 10%, transparent)
        );
      }
    }
  }

  .bb-button-text {
    border: none;
    background: transparent;

    &:not([disabled]) {
      &:focus,
      &:hover {
        background: var(
          --bb-button-hover-background,
          color-mix(in srgb, currentColor 10%, transparent)
        );
      }
    }
  }
`;
