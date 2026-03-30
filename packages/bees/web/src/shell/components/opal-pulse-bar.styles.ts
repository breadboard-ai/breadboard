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
  .pulse-hero {
    font-size: 16px;
    max-width: 480px;
    text-align: center;
    line-height: 1.6;
    color: var(--cg-color-on-surface, #e5e1e6);
  }
  .pulse-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 48px;
    background: var(--cg-color-surface-container-lowest, #121316);
    border-top: 1px solid var(--cg-color-outline-variant, #49454e);
    flex-shrink: 0;
    position: relative;
    z-index: 101;
  }
  .pulse-content {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }
  .pulse-text {
    font-size: 13px;
    color: var(--cg-color-on-surface-muted, #9a969e);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pulse-idle {
    font-style: italic;
    opacity: 0.6;
  }
  .pulse-opie-trigger {
    background: transparent;
    color: var(--cg-color-primary, #a8c7fa);
    border: 1px solid var(--cg-color-outline-variant, #49454e);
    border-radius: 999px;
    padding: 4px 14px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 150ms cubic-bezier(0.2, 0, 0, 1);
  }
  .pulse-opie-icon {
    font-size: 11px;
    opacity: 0.7;
  }
  .pulse-opie-trigger:hover {
    background: var(--cg-color-surface-container, #232429);
    border-color: var(--cg-color-primary, #a8c7fa);
  }
`;
