/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

/**
 * Styles for the collapsible JSON tree and expand/collapse toggle.
 * Shared between log-detail and any other component that renders JSON trees.
 */
export const jsonTreeStyles = css`
  .json-tree {
    font-family: "Google Mono", "Roboto Mono", monospace;
    font-size: 0.7rem;
    line-height: 1.6;
  }

  .json-tree details.json-node {
    border: none;
    border-radius: 0;
    overflow: visible;
  }

  .json-tree details.json-node summary {
    padding: 0;
    margin: 0;
    font-size: inherit;
    font-weight: normal;
    color: inherit;
    text-transform: none;
    letter-spacing: normal;
    background: transparent;
    border-bottom: none;
    list-style: none;
    cursor: pointer;
    display: inline;
  }

  .json-tree details.json-node summary::-webkit-details-marker {
    display: none;
  }

  .json-tree details.json-node summary::before {
    content: "▸ ";
    color: #475569;
  }

  .json-tree details.json-node[open] > summary::before {
    content: "▾ ";
  }

  .json-tree details.json-node[open] > summary .json-preview {
    display: none;
  }

  .json-children {
    margin-left: 16px;
  }

  .json-leaf {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .json-key {
    color: #b1abda;
    font-weight: 600;
  }

  .json-preview {
    color: #475569;
    font-style: italic;
  }

  .json-string {
    color: #9fcfa6;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .json-string.long {
    max-height: 150px;
    overflow: hidden;
    display: block;
    position: relative;
  }

  .json-string.long::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 30px;
    background: linear-gradient(transparent, #0f1115);
    pointer-events: none;
  }

  .json-number {
    color: #9191ff;
  }

  .json-boolean {
    color: #9be9ed;
  }

  .json-null {
    color: #64748b;
    font-style: italic;
  }

  .json-empty {
    color: #64748b;
    font-style: italic;
  }

  /* ── Expand / collapse toggle ── */
  .expand-toggle {
    position: absolute;
    bottom: 4px;
    right: 4px;
    z-index: 2;
    padding: 2px 6px;
    border: none;
    border-radius: 4px;
    background: #1e293b;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: inherit;
    line-height: 1;
    transform: rotate(90deg);
    opacity: 0.85;
    transition: opacity 0.15s, color 0.15s;
  }

  .expand-toggle:hover {
    opacity: 1;
    color: #e2e8f0;
  }

  .expanded {
    max-height: none !important;
    overflow: visible !important;
  }

  .expanded::after {
    display: none !important;
  }
`;
