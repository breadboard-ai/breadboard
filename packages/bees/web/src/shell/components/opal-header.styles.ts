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
    background: var(--cg-color-surface-container-lowest, #121316);
    border-bottom: 1px solid var(--cg-color-outline-variant, #49454e);
    flex-shrink: 0;
    z-index: 10;
  }
  .brand-icon {
    font-size: 20px;
    color: var(--cg-color-primary, #a8c7fa);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--cg-color-primary, #a8c7fa);
    letter-spacing: -0.02em;
  }
  .back-button {
    background: transparent;
    border: none;
    color: var(--cg-color-primary, #a8c7fa);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    margin-left: -8px;
    border-radius: 8px;
    transition: background 0.2s ease;
  }
  .back-button:hover {
    background: var(--cg-color-surface-bright, #2a2b30);
  }
  .actions a {
    font-size: 13px;
    color: var(--cg-color-on-surface-muted, #9a969e);
    text-decoration: none;
    border: 1px solid var(--cg-color-outline-variant, #49454e);
    padding: 4px 12px;
    border-radius: 8px;
    transition: all 150ms cubic-bezier(0.2, 0, 0, 1);
  }
  .actions a:hover {
    color: var(--cg-color-on-surface, #e5e1e6);
    border-color: var(--cg-color-outline, #7a767e);
    background: var(--cg-color-surface-container, #232429);
  }
`;
