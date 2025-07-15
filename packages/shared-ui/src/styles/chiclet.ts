/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";
import { colorsLight } from "./host/colors-light";
import { type } from "./host/type";

export const styles = [
  type,
  colorsLight,
  css`
    .chiclet {
      cursor: pointer;
      display: inline-flex;
      padding: 0 var(--bb-grid-size-2) 0;
      background: var(--bb-neutral-50);
      color: var(--bb-neutral-700);
      border-radius: var(--bb-grid-size-2);
      border: none;
      height: var(--bb-grid-size-5);
      caret-color: transparent;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      user-select: none;
      white-space: nowrap;
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);

      & * {
        caret-color: transparent;
        &::selection {
          background: none;
        }
      }

      & span {
        display: none;

        &.g-icon {
          user-select: none;
          display: inline;
          pointer-events: none;
          font-size: 16px;
          margin-right: var(--bb-grid-size);
          flex: 0 0 auto;

          &::after {
            content: attr(data-icon);
          }
        }

        &.visible {
          display: inline;
          pointer-events: none;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      &.core,
      &.input {
        background: var(--ui-get-input-secondary) 5px center / 16px 16px
          no-repeat;
        color: var(--n-10);
      }

      &.generative {
        background: var(--ui-generate-secondary) 5px center / 16px 16px
          no-repeat;
        color: var(--n-10);
      }

      &.asset {
        background: var(--ui-asset-secondary) 5px center / 16px 16px no-repeat;
        color: var(--n-10);
      }

      &.tool {
        background: var(--n-90) 5px center / 16px 16px no-repeat;
        color: var(--n-10);
      }

      &.param {
        background: var(--n-60) 5px center / 16px 16px no-repeat;
        color: var(--n-10);
      }

      &.selected {
        outline: 1px solid var(--n-0);
      }

      &.invalid {
        background-color: var(--bb-warning-100);
        color: var(--bb-warning-700);
      }
    }
  `,
] as CSSResultGroup;
