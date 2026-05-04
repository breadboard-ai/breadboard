/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared styles consumed by multiple hivetool components.
 *
 * Contains the common design tokens, block/card styles, identity chips,
 * and utility classes that are used across list and detail panels.
 */

import { css } from "lit";

export { sharedStyles, scrollbarStyles };

const scrollbarStyles = css`
  * {
    scrollbar-width: thin;
    scrollbar-color: #334155 transparent;
  }

  *::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  *::-webkit-scrollbar-track {
    background: transparent;
  }

  *::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 3px;
  }

  *::-webkit-scrollbar-thumb:hover {
    background: #475569;
  }
`;

const sharedStyles = css`
  ${scrollbarStyles}

  * {
    box-sizing: border-box;
  }

  a {
    color: #60a5fa;
    text-decoration: none;
    transition: color 0.15s;
  }

  a:hover {
    color: #93c5fd;
    text-decoration: underline;
  }

  a:visited {
    color: #818cf8;
  }

  .mono {
    font-family: "Google Mono", "Roboto Mono", monospace;
  }

  /* ── List items (sidebar) ── */
  .jobs-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .job-item {
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .job-item:hover {
    background: #1e293b;
  }

  .job-item.selected {
    background: #1e293b;
    border-color: #334155;
  }

  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .job-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .job-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .job-status.running {
    background: #3b82f6;
    box-shadow: 0 0 8px #3b82f688;
    animation: pulse 2s infinite;
  }
  .job-status.completed {
    background: #10b981;
  }
  .job-status.failed {
    background: #ef4444;
  }
  .job-status.suspended {
    background: #f59e0b;
  }
  .job-status.paused {
    background: #f87171;
  }

  .job-meta {
    font-size: 0.75rem;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }

  /* ── Detail panel ── */
  .job-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .job-detail-header {
    padding: 24px 32px;
    border-bottom: 1px solid #1e293b;
    background: #0f1115;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .job-detail-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .job-detail-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .job-detail-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .job-detail-badge.running {
    background: #1d4ed833;
    color: #60a5fa;
    border: 1px solid #1d4ed8;
  }
  .job-detail-badge.completed {
    background: #065f4633;
    color: #34d399;
    border: 1px solid #065f46;
  }
  .job-detail-badge.failed {
    background: #991b1b33;
    color: #f87171;
    border: 1px solid #991b1b;
  }
  .job-detail-badge.suspended {
    background: #92400e33;
    color: #fbbf24;
    border: 1px solid #92400e;
  }
  .job-detail-badge.paused {
    background: #991b1b33;
    color: #f87171;
    border: 1px solid #991b1b;
  }

  .job-detail-meta {
    font-size: 0.85rem;
    color: #94a3b8;
    display: flex;
    gap: 16px;
  }

  /* ── Timeline / content blocks ── */
  .timeline {
    padding: 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 960px;
    margin: 0 auto;
    width: 100%;
  }

  .block {
    background: #0f1115;
    border: 1px solid #1e293b;
    border-radius: 8px;
    font-size: 0.8rem;
    overflow: hidden;
  }

  .block-header {
    background: #14171c;
    padding: 5px 10px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    border-bottom: 1px solid #1e293b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .block-content {
    padding: 8px 10px;
    color: #e2e8f0;
    line-height: 1.5;
    font-family: inherit;
    margin: 0;
  }

  .block.error {
    border-color: #991b1b;
  }
  .block.error .block-header {
    background: #450a0a;
    color: #fca5a5;
    border-bottom-color: #991b1b;
  }
  .block.error .block-content {
    color: #fecaca;
  }

  .block.outcome {
    border-color: #065f46;
  }
  .block.outcome .block-header {
    background: #022c22;
    color: #6ee7b7;
    border-bottom-color: #065f46;
  }

  /* ── Identity chips ── */
  .identity-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .identity-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: "Google Mono", "Roboto Mono", monospace;
    background: #1e293b;
    color: #94a3b8;
    border: 1px solid #334155;
  }

  .identity-chip.linkable {
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .identity-chip.linkable:hover {
    background: #253347;
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .identity-chip.model {
    background: #1a1526;
    color: #c4b5fd;
    border-color: #2d2540;
  }

  .identity-chip.playbook {
    background: #111d1f;
    color: #5eead4;
    border-color: #1a3338;
  }

  .identity-chip.skill {
    background: #1e3a8a22;
    color: #93c5fd;
    border-color: #1e3a5c;
  }

  .identity-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  /* ── Context card ── */
  .context-card {
    background: #111827;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 8px 12px;
  }

  .context-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #a78bfa;
    margin-bottom: 6px;
  }

  /* ── Tool / signal badges ── */
  .tool-badge {
    padding: 4px 8px;
    background: #1e3a8a;
    color: #bfdbfe;
    border-radius: 4px;
    font-family: "Google Mono", monospace;
    font-size: 0.75rem;
  }

  .signal-chip {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    font-family: "Google Mono", "Roboto Mono", monospace;
    background: #134e4a;
    color: #5eead4;
  }

  /* ── Backlink chips ── */
  .backlink-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .backlink-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
    background: #1e293b;
    color: #94a3b8;
    border: 1px solid #334155;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .backlink-chip.linkable {
    cursor: pointer;
  }

  .backlink-chip.linkable:hover {
    background: #253347;
    border-color: #3b82f6;
    color: #93c5fd;
  }

  /* ── Empty state ── */
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 0.9rem;
  }

  /* ── Lightning flash ── */
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes lightning-flash {
    0% {
      background-color: rgba(96, 165, 250, 0.8);
      box-shadow: 0 0 20px rgba(96, 165, 250, 0.6);
    }
    2% {
      background-color: rgba(96, 165, 250, 0.3);
      box-shadow: 0 0 10px rgba(96, 165, 250, 0.2);
    }
    100% {
      background-color: transparent;
      box-shadow: none;
    }
  }

  .lightning-flash {
    animation: lightning-flash 15s ease-out !important;
  }
`;
