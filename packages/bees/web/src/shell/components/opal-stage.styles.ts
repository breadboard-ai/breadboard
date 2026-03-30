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
    background: var(--cg-color-surface, #1f2024);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--cg-color-on-surface-muted, #9a969e);
  }
  .empty-icon {
    font-size: 48px;
    color: var(--cg-color-outline-variant, #49454e);
  }
  .empty h2 {
    font-size: 24px;
    font-weight: 600;
    color: var(--cg-color-on-surface, #e5e1e6);
    letter-spacing: -0.02em;
  }
  .empty p {
    font-size: 14px;
    max-width: 400px;
    text-align: center;
    line-height: 1.6;
  }
  .status-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 500px;
    padding: 0 24px;
    align-items: stretch;
  }
  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--cg-color-surface-container, #232429);
    border: 1px solid var(--cg-color-outline-variant, #49454e);
    border-radius: 8px;
    font-size: 14px;
  }
  .status-title {
    color: var(--cg-color-on-surface, #e5e1e6);
    font-weight: 500;
  }
  .status-badge {
    color: var(--cg-color-on-surface-muted, #9a969e);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .status-badge.success {
    color: var(--cg-color-primary, #a8c7fa);
  }
  .status-badge.error {
    color: var(--cg-color-error, #ffb4ab);
  }
`;
