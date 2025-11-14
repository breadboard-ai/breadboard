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
      background: var(--n-98);
      color: var(--n-40);
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

          &.target {
            margin-left: var(--bb-grid-size-4);
          }

          &.down-arrow {
            margin-left: var(--bb-grid-size-2);
          }
        }

        &.visible-after {
          font-size: 0;
          display: inline-flex;
          justify-content: center;
          vertical-align: middle;
          user-select: none;
          pointer-events: none;
          width: calc(100% - var(--bb-grid-size-5));
          max-width: 145px;
          white-space: pre;

          &::after {
            font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family-mono);
            line-height: var(--bb-grid-size-5);
            content: attr(data-label);
            display: inline;
            pointer-events: none;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          &[data-label=""] {
            min-width: 65px;
          }
        }
      }

      &.core,
      &.input {
        background: var(--ui-get-input-secondary) 5px center / 16px 16px
          no-repeat;
        color: var(--n-10);
      }

      &.output {
        background: var(--ui-display) 5px center / 16px 16px no-repeat;
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
        background-color: var(--e-90);
        color: var(--e-30);
      }
    }
  `,
] as CSSResultGroup;
