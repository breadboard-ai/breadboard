/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    flex-shrink: 0;
    width: 100%;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: var(--cg-color-surface, #fdfcfa);
    border-bottom: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    flex-shrink: 0;
    z-index: 10;
  }
  .brand-icon {
    font-size: 20px;
    color: var(--cg-color-primary, #3b5fc0);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
    letter-spacing: -0.02em;
  }
  .back-button {
    background: transparent;
    border: none;
    color: var(--cg-color-primary, #3b5fc0);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    margin-left: -8px;
    border-radius: 8px;
    transition: background 0.15s ease;
  }
  .back-button:hover {
    background: var(--cg-color-surface-container-high, #eae8e5);
  }
  .actions a {
    font-size: 13px;
    color: var(--cg-color-on-surface-muted, #79757f);
    text-decoration: none;
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    padding: 4px 12px;
    border-radius: 8px;
    transition: all 150ms cubic-bezier(0.2, 0, 0, 1);
  }
  .actions a:hover {
    color: var(--cg-color-on-surface, #1c1b1f);
    border-color: var(--cg-color-outline, #7a767e);
    background: var(--cg-color-surface-container, #f0eeeb);
  }
`;
