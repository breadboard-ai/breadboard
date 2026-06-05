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

    bb-workbench-splitter {
      width: 100%;
      height: 100%;
    }

    .agent-config-column {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: var(--light-dark-n-100);
      padding: 0;
      gap: 0;
      overflow: hidden;
    }

    /* ── Floaty Runs Panel ── */

    .runs-panel-overlay {
      position: absolute;
      inset: 0;
      z-index: 60;
      pointer-events: none; /* Let clicks pass through to the underlying UI! */
      display: flex;
      justify-content: flex-end;
      padding: var(--bb-grid-size-4);
    }

    .runs-panel {
      pointer-events: auto; /* Capture clicks inside the runs panel */
      width: 420px;
      max-width: 50%;
      height: 100%;
      background: light-dark(var(--n-100), var(--n-15));
      border-radius: var(--bb-grid-size-4);
      border: 1px solid var(--light-dark-n-90);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.12),
        0 2px 8px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateX(calc(100% + var(--bb-grid-size-4)));
      opacity: 0;
      transition:
        transform 0.3s cubic-bezier(0.2, 0, 0, 1),
        opacity 0.2s ease;
    }

    .runs-panel-overlay.open .runs-panel {
      transform: translateX(0);
      opacity: 1;
    }

    .runs-panel bb-run-log-column {
      flex: 1;
      min-height: 0;
    }

    /* ── Control stack ── */

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

        &.active {
          background-color: light-dark(var(--p-90), var(--p-30));
          color: light-dark(var(--p-40), var(--p-80));
        }
      }
    }
  `,
];
