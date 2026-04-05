/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const logDetailStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    color: #e2e8f0;
    font-family: inherit;
  }

  * {
    box-sizing: border-box;
  }

  .mono {
    font-family: "Google Mono", "Roboto Mono", monospace;
  }

  /* ── Header ── */
  .header {
    padding: 24px 32px;
    border-bottom: 1px solid #1e293b;
    background: #0f1115;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .header-meta {
    display: flex;
    gap: 16px;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  /* ── Token bar (visual) ── */
  .token-visual {
    padding: 14px 32px;
    background: #111318;
    border-bottom: 1px solid #1e293b;
  }

  .token-visual.compact {
    padding: 0;
    background: transparent;
    border-bottom: none;
    margin-top: 8px;
  }

  .token-track {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .token-scale {
    font-size: 0.6rem;
    font-family: "Google Mono", "Roboto Mono", monospace;
    color: #475569;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .token-segments {
    display: flex;
    flex: 1;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    background: #1e293b;
  }

  .token-visual.compact .token-segments {
    height: 6px;
    border-radius: 3px;
  }

  .token-tick {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: #ef4444;
    border-radius: 1px;
    opacity: 0.7;
    pointer-events: none;
  }

  .token-visual.compact .token-tick {
    top: -1px;
    bottom: -1px;
    width: 1px;
  }

  .token-seg {
    height: 100%;
    min-width: 3px;
    transition: width 0.3s ease;
  }

  .token-seg.cached {
    background: #10b981;
  }
  .token-seg.prompt {
    background: #3b82f6;
  }
  .token-seg.thoughts {
    background: #a78bfa;
  }
  .token-seg.output {
    background: #f59e0b;
  }

  .token-legend {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    font-size: 0.7rem;
    color: #94a3b8;
    flex-wrap: wrap;
    align-items: baseline;
  }

  .token-legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .legend-value {
    color: #e2e8f0;
    font-weight: 600;
    font-family: "Google Mono", "Roboto Mono", monospace;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dot.cached {
    background: #10b981;
  }
  .dot.prompt {
    background: #3b82f6;
  }
  .dot.thoughts {
    background: #a78bfa;
  }
  .dot.output {
    background: #f59e0b;
  }

  .token-legend-total {
    margin-left: auto;
    font-family: "Google Mono", "Roboto Mono", monospace;
    color: #64748b;
  }

  /* ── Collapsible sections ── */
  details {
    border: 1px solid #1e293b;
    border-radius: 8px;
    overflow: hidden;
  }

  details summary {
    cursor: pointer;
    user-select: none;
    padding: 8px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: #14171c;
    border-bottom: 1px solid #1e293b;
    list-style: none;
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details summary::before {
    content: "▸ ";
  }

  details[open] summary::before {
    content: "▾ ";
  }

  details .section-body {
    padding: 12px;
    font-size: 0.8rem;
    line-height: 1.6;
    white-space: pre-wrap;
    color: #cbd5e1;
    max-height: 400px;
    overflow-y: auto;
  }

  /* ── Conversation turns ── */
  .conversation {
    padding: 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 960px;
    margin: 0 auto;
    width: 100%;
  }

  .conversation-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }

  .sections {
    padding: 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 960px;
    margin: 0 auto;
    width: 100%;
  }

  .turn {
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .turn.user {
    background: #1e293b;
    border: 1px solid #334155;
  }

  .turn.model {
    background: #111827;
    border: 1px solid #1e293b;
  }

  .turn-role {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }

  .turn.user .turn-role {
    color: #60a5fa;
  }

  .turn.model .turn-role {
    color: #a78bfa;
  }

  .turn.system {
    background: #111d1f;
    border: 1px solid #1a3338;
  }

  .turn.system .turn-role {
    color: #2dd4bf;
  }

  .turn-parts {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ── Part variants ── */
  .part-text {
    color: #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;
    overflow: hidden;
    max-height: 200px;
    position: relative;
  }

  .part-text.long::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    background: linear-gradient(transparent, #1e293b);
    pointer-events: none;
  }

  .turn.model .part-text.long::after {
    background: linear-gradient(transparent, #111827);
  }

  .part-thought {
    color: #94a3b8;
    font-style: italic;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow: hidden;
    position: relative;
  }

  .part-thought::before {
    content: "💭 ";
  }

  .part-thought.long::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 30px;
    background: linear-gradient(transparent, #111827);
    pointer-events: none;
  }

  .part-function-call {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .fn-badge {
    padding: 4px 8px;
    background: #1e3a8a;
    color: #bfdbfe;
    border-radius: 4px;
    font-family: "Google Mono", "Roboto Mono", monospace;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .fn-args {
    color: #64748b;
    font-family: "Google Mono", "Roboto Mono", monospace;
    font-size: 0.7rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 500px;
  }

  .part-function-response {
    padding: 6px 10px;
    background: #0f1115;
    border: 1px solid #1e293b;
    border-radius: 6px;
    font-family: "Google Mono", "Roboto Mono", monospace;
    font-size: 0.7rem;
    color: #94a3b8;
    max-height: 150px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .fn-response-name {
    color: #60a5fa;
    font-weight: 600;
    margin-bottom: 4px;
  }

  /* ── Tools list ── */
  .tools-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 0;
  }

  .tool-chip {
    padding: 3px 8px;
    background: #1e3a8a44;
    color: #93c5fd;
    border-radius: 4px;
    font-family: "Google Mono", "Roboto Mono", monospace;
    font-size: 0.7rem;
  }

  /* ── Empty ── */
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
    font-size: 0.9rem;
  }

  /* ── Segment dividers ── */
  .segment-block {
    margin: 20px 0 12px;
    display: flex;
    flex-direction: column;
  }

  .segment-divider {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .segment-divider::before,
  .segment-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #334155;
  }

  .segment-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 0 12px;
    white-space: nowrap;
  }

  .segment-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: #60a5fa;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .segment-stats {
    font-size: 0.65rem;
    color: #64748b;
    font-family: "Google Mono", "Roboto Mono", monospace;
  }

  /* ── Header badge ── */
  .segment-count {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    background: #1e3a8a33;
    color: #60a5fa;
    border: 1px solid #1e3a8a;
  }

  /* ── Turn headers (label + bar + numbers in one row) ── */
  .turn-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 14px 0 6px;
    padding: 0;
  }

  .turn-header-label {
    font-size: 0.6rem;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .turn-header-bar {
    flex: 1;
    min-width: 60px;
  }

  .turn-header-bar .token-segments {
    height: 6px;
    border-radius: 3px;
  }

  .turn-header-tokens {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    font-size: 0.65rem;
  }

  .turn-header-total {
    color: #64748b;
    font-family: "Google Mono", "Roboto Mono", monospace;
    font-weight: 600;
  }
`;
