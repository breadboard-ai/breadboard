/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const styles = css`
  :host {
    display: flex;
    flex-direction: row;
    height: 100vh;
    width: 100vw;
    margin: 0;
    padding: 0;
    background: #0f1115;
    color: #e2e8f0;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
      sans-serif;
    overflow: hidden;
  }

  * {
    box-sizing: border-box;
  }

  .mono {
    font-family: "Google Mono", "Roboto Mono", monospace;
  }

  /* --- Sidebar --- */
  .sidebar {
    width: 320px;
    background: #0f1115;
    border-right: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 24px 20px 12px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sidebar-header h1 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sidebar-tabs {
    display: flex;
    padding: 0 20px;
    border-bottom: 1px solid #1e293b;
    margin-bottom: 8px;
  }

  .sidebar-tab {
    padding: 12px 16px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s;
    user-select: none;
  }

  .sidebar-tab.active {
    color: #f8fafc;
    border-bottom-color: #3b82f6;
  }

  .sidebar-tab:hover:not(.active) {
    color: #cbd5e1;
  }

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

  .job-meta {
    font-size: 0.75rem;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }

  /* --- Main Content --- */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #0b0c0f;
    height: 100%;
    overflow: hidden;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 0.9rem;
  }

  /* Job Detail */
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

  .job-detail-meta {
    font-size: 0.85rem;
    color: #94a3b8;
    display: flex;
    gap: 16px;
  }

  /* Timeline Steps */
  .timeline {
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 32px;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  .step {
    position: relative;
    padding-left: 28px;
  }

  .step::before {
    content: "";
    position: absolute;
    left: 7px;
    top: 24px;
    bottom: -40px;
    width: 2px;
    background: #1e293b;
  }

  .step:last-child::before {
    display: none;
  }

  .step-node {
    position: absolute;
    left: 0;
    top: 6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #0b0c0f;
    border: 2px solid #334155;
    z-index: 2;
  }

  .step.running .step-node {
    border-color: #3b82f6;
    background: #3b82f6;
    box-shadow: 0 0 10px #3b82f688;
  }
  .step.completed .step-node {
    border-color: #10b981;
    background: #10b981;
  }
  .step.failed .step-node {
    border-color: #ef4444;
    background: #ef4444;
  }
  .step.suspended .step-node {
    border-color: #f59e0b;
    background: #f59e0b;
  }

  .step-card {
    background: #181b21;
    border: 1px solid #1e293b;
    border-radius: 12px;
    overflow: hidden;
  }

  .step-header {
    padding: 16px;
    border-bottom: 1px solid #1e293b;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #111318;
  }

  .step-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-id {
    font-size: 0.75rem;
    color: #64748b;
    font-family: "Google Mono", "Roboto Mono", monospace;
  }

  .step-time {
    font-size: 0.75rem;
    color: #64748b;
  }

  .step-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step-objective {
    font-size: 0.85rem;
    color: #cbd5e1;
    line-height: 1.5;
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
    padding: 6px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    border-bottom: 1px solid #1e293b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .block-content {
    padding: 12px;
    color: #e2e8f0;
    white-space: pre-wrap;
    line-height: 1.5;
    font-family: inherit;
    margin: 0;
  }

  .block-content.mono {
    font-family: var(--sys-typescale-mono-font, monospace);
    font-size: 0.75rem;
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

  /* Logs / Trace */
  .trace-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }

  .trace-item {
    font-size: 0.75rem;
    display: flex;
    gap: 8px;
  }

  .trace-item.thought {
    color: #94a3b8;
  }
  .trace-item.tool {
    color: #60a5fa;
    font-family: "Google Mono", monospace;
  }
  .trace-item.error {
    color: #f87171;
  }

  .metrics {
    display: flex;
    gap: 12px;
    font-size: 0.75rem;
    color: #64748b;
  }

  /* Action Bars */
  .action-bar {
    padding: 16px;
    background: #1e293b;
    border-radius: 8px;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  input,
  textarea,
  button {
    font-family: inherit;
  }

  input {
    padding: 8px 12px;
    background: #0f1115;
    border: 1px solid #334155;
    color: #e2e8f0;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  button {
    padding: 8px 16px;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.85rem;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }

  button:hover {
    opacity: 0.9;
  }

  /* Tool details */
  .tool-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .tool-badge {
    padding: 4px 8px;
    background: #1e3a8a;
    color: #bfdbfe;
    border-radius: 4px;
    font-family: "Google Mono", monospace;
    font-size: 0.75rem;
  }

  .delivered-to {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .delivered-to-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .delivered-to-id {
    padding: 2px 6px;
    background: #1e293b;
    color: #94a3b8;
    border-radius: 4px;
    font-family: "Google Mono", monospace;
    font-size: 0.7rem;
  }

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
`;
