/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    width: 100%;
  }
  .stage {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .stage iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: var(--cg-color-surface, #fdfcfa);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--cg-color-on-surface-muted, #79757f);
  }
  .empty-icon {
    font-size: 48px;
    color: var(--cg-color-outline-variant, #e0ddd9);
  }
  .empty h2 {
    font-size: 22px;
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
    letter-spacing: -0.02em;
  }
  .empty p {
    font-size: 14px;
    max-width: 360px;
    text-align: center;
    line-height: 1.6;
  }
`;
