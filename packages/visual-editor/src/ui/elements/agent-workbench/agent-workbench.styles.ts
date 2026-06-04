/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";
import * as Styles from "../../styles/styles.js";

export const styles = [
  Styles.HostType.type,
  Styles.HostIcons.icons,
  Styles.HostColorsBase.baseColors,
  Styles.HostColorScheme.match,
  css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      background: var(--light-dark-n-98);
    }

    ui-tri-splitter {
      width: 100%;
      height: 100%;
    }

    .column-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: light-dark(var(--n-98), var(--n-20));
      color: light-dark(var(--n-40), var(--n-80));
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-8);
      text-align: center;
      overflow: auto;

      &[slot="s0"] {
        background: light-dark(var(--n-98), var(--n-15));
      }

      &[slot="s1"] {
        background: light-dark(var(--n-100), var(--n-0));
      }

      & .g-icon {
        font-size: 48px;
        margin-bottom: var(--bb-grid-size-4);
        color: light-dark(var(--n-70), var(--n-50));
      }
    }

    .agent-config-column {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: var(--light-dark-n-100);
      border: 1px solid var(--light-dark-n-90);
      border-radius: var(--bb-grid-size-3);
      padding: 0;
      gap: 0;
      overflow: hidden;
    }

    #workbench-controls {
      position: absolute;
      display: flex;
      flex-direction: column;
      right: var(--bb-grid-size-6);
      bottom: var(--bb-grid-size-7);
      background: light-dark(var(--n-100), var(--n-20));
      border-radius: var(--bb-grid-size-16);
      padding: var(--bb-grid-size) var(--bb-grid-size);
      box-shadow: light-dark(var(--bb-elevation-16-light), none);
      z-index: 50;
      pointer-events: auto;

      & button {
        color: light-dark(var(--n-0), var(--n-80));
        background: light-dark(var(--n-100), var(--n-20)) center center / 20px
          20px no-repeat;
        width: var(--bb-grid-size-7);
        height: var(--bb-grid-size-7);
        padding: 0;
        border: none;
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        border-radius: var(--bb-grid-size);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: var(--bb-grid-size);

        & .g-icon {
          pointer-events: none;
        }

        &:first-child {
          margin-top: 0;
          border-radius: var(--bb-grid-size-12) var(--bb-grid-size-12)
            var(--bb-grid-size) var(--bb-grid-size);
        }

        &:last-child {
          border-radius: var(--bb-grid-size) var(--bb-grid-size)
            var(--bb-grid-size-12) var(--bb-grid-size-12);
          margin-bottom: 0;
        }

        &[disabled] {
          opacity: 0.38;
          cursor: not-allowed;
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background-color: light-dark(var(--n-90), var(--n-30));
          }
        }
      }
    }
  `,
];
