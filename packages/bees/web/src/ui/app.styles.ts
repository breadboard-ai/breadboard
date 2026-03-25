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
    height: 100vh;
    max-width: 900px;
    margin: 0 auto;
    padding: 24px;
    gap: 24px;
  }

  /* ---- Header ---- */

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .header h1 span {
    color: var(--sys-color-primary);
  }

  .header-right {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sys-color-tertiary);
    animation: pulse 2s ease-in-out infinite;
  }

  .status-dot.draining {
    background: var(--sys-color-primary);
    animation: pulse 0.8s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .filter-input {
    padding: 6px 10px;
    background: var(--sys-color-surface-variant);
    color: var(--sys-color-on-surface);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-small);
    font-family: var(--sys-typescale-mono-font);
    font-size: 0.8rem;
  }

  .filter-input:focus {
    border-color: var(--sys-color-primary);
    outline: none;
  }

  .filter-input::placeholder {
    color: var(--sys-color-outline);
  }

  /* ---- Add form ---- */

  .add-form {
    display: flex;
    gap: 8px;
  }

  .add-form input {
    padding: 12px 16px;
    font-family: var(--sys-typescale-mono-font);
    font-size: 0.875rem;
    background: var(--sys-color-surface-variant);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-small);
    color: var(--sys-color-on-surface);
    transition: border-color 0.15s;
  }

  .add-form input::placeholder {
    color: var(--sys-color-outline);
  }

  .add-form input:focus {
    border-color: var(--sys-color-primary);
    outline: none;
  }

  .objective-input {
    flex: 2;
  }

  .tags-input {
    flex: 1;
  }

  .add-form button {
    padding: 12px 20px;
    font-family: var(--sys-typescale-body-font);
    font-size: 0.875rem;
    font-weight: 600;
    background: var(--sys-color-primary);
    color: var(--sys-color-on-primary);
    border: none;
    border-radius: var(--sys-shape-corner-small);
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }

  .add-form button:hover {
    opacity: 0.85;
  }

  .add-form button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ---- Ticket list ---- */

  .tickets {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    flex: 1;
  }

  .ticket {
    background: var(--sys-color-surface);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-medium);
    padding: 16px;
    transition: border-color 0.15s;
  }

  .ticket:hover {
    border-color: var(--sys-color-outline);
  }

  .ticket-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .ticket-id {
    font-family: var(--sys-typescale-mono-font);
    font-size: 0.75rem;
    color: var(--sys-color-outline);
  }

  .ticket-time {
    color: var(--sys-color-outline);
    font-size: 0.75rem;
  }

  .ticket-objective {
    font-size: 0.875rem;
    color: var(--sys-color-on-surface);
    line-height: 1.5;
    font-family: var(--sys-typescale-mono-font);
  }

  /* ---- Badges ---- */

  .badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--sys-shape-corner-full);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge.available {
    background: var(--ext-color-info-container);
    color: var(--ext-color-info);
  }
  .badge.blocked {
    background: var(--ext-color-blocked-container);
    color: var(--ext-color-blocked);
  }
  .badge.running {
    background: var(--sys-color-primary-container);
    color: var(--sys-color-primary);
  }
  .badge.suspended {
    background: var(--ext-color-warning-container);
    color: var(--ext-color-warning);
  }
  .badge.completed {
    background: var(--sys-color-tertiary-container);
    color: var(--sys-color-tertiary);
  }
  .badge.failed {
    background: var(--sys-color-error-container);
    color: var(--sys-color-error);
  }

  .badge.muted {
    background: var(--sys-color-surface-variant);
    color: var(--sys-color-on-surface-variant);
  }

  /* ---- Tags row ---- */

  .ticket-tags {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .tags-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .no-tags {
    color: var(--sys-color-outline);
    font-size: 0.75rem;
  }

  .btn-edit {
    padding: 2px 6px;
    font-size: 0.6875rem;
    background: var(--sys-color-surface-variant);
    color: var(--sys-color-on-surface-variant);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-extra-small);
    cursor: pointer;
  }

  /* ---- Tag editor ---- */

  .tag-editor {
    margin-top: 8px;
    padding: 8px;
    background: var(--sys-color-surface-variant);
    border-radius: var(--sys-shape-corner-small);
    border: 1px solid var(--sys-color-outline-variant);
  }

  .tag-editor input {
    width: 100%;
    padding: 4px;
    background: var(--sys-color-surface);
    color: var(--sys-color-on-surface);
    border: none;
    border-radius: var(--sys-shape-corner-extra-small);
    font-family: var(--sys-typescale-mono-font);
    font-size: 0.8rem;
  }

  .tag-editor-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .btn-cancel {
    font-size: 0.75rem;
    padding: 4px 8px;
    background: transparent;
    color: var(--sys-color-on-surface-variant);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-extra-small);
    cursor: pointer;
  }

  .btn-save {
    font-size: 0.75rem;
    padding: 4px 8px;
    background: var(--sys-color-surface-variant);
    color: var(--sys-color-on-surface);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-extra-small);
    cursor: pointer;
    font-weight: bold;
  }

  /* ---- Dependencies ---- */

  .ticket-deps {
    margin-top: 6px;
    font-size: 0.75rem;
    color: var(--sys-color-outline);
  }

  .ticket-deps code {
    color: var(--ext-color-blocked);
  }

  /* ---- Outcome / error ---- */

  .ticket-outcome {
    margin-top: 10px;
    padding: 10px 12px;
    background: var(--sys-color-surface-variant);
    border-radius: var(--sys-shape-corner-small);
    font-size: 0.8rem;
    color: var(--sys-color-on-surface-variant);
    line-height: 1.5;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
  }

  .ticket-error {
    margin-top: 10px;
    padding: 8px 12px;
    background: var(--sys-color-error-container);
    border-radius: var(--sys-shape-corner-small);
    font-size: 0.8rem;
    color: var(--sys-color-error);
  }

  /* ---- Respond widget ---- */

  .respond-prompt {
    margin-top: 10px;
    padding: 10px 12px;
    background: var(--ext-color-warning-container);
    border-radius: var(--sys-shape-corner-small);
    font-size: 0.8rem;
    color: var(--ext-color-warning);
  }

  .respond-form {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .respond-form.choices {
    flex-direction: column;
    align-items: flex-start;
  }

  .choices-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .respond-form.multiple .choices-list {
    flex-direction: column;
    width: 100%;
  }

  .choice-label {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    padding: 8px 12px;
    background: var(--sys-color-surface-variant);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-medium);
    cursor: pointer;
    font-size: 0.8rem;
    transition: background-color 0.15s, border-color 0.15s;
    user-select: none;
  }

  .respond-form.choices .choices-list .choice-label input {
    flex: 0 0 auto;
    width: auto;
  }

  .choice-label:hover {
    background: var(--sys-color-primary-container);
    border-color: var(--sys-color-primary);
  }

  .respond-form.single .choice-label {
    border-radius: 16px; /* Pill chip */
  }

  .respond-form.multiple .choice-label {
    width: 100%;
    box-sizing: border-box;
  }

  .respond-form input {
    flex: 1;
    padding: 8px 12px;
    font-family: var(--sys-typescale-mono-font);
    font-size: 0.8rem;
    background: var(--sys-color-surface-variant);
    border: 1px solid var(--sys-color-outline-variant);
    border-radius: var(--sys-shape-corner-small);
    color: var(--sys-color-on-surface);
  }

  .respond-form input:focus {
    border-color: var(--ext-color-warning);
    outline: none;
  }

  .respond-form button {
    padding: 8px 14px;
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--ext-color-warning);
    color: var(--sys-color-on-primary);
    border: none;
    border-radius: var(--sys-shape-corner-small);
    cursor: pointer;
  }

  /* ---- Event logs ---- */

  .ticket-logs {
    margin-top: 8px;
    font-family: var(--sys-typescale-mono-font);
    font-size: 0.8rem;
    background: var(--sys-color-surface-variant);
    padding: 8px;
    border-radius: var(--sys-shape-corner-small);
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .log-thought {
    color: var(--sys-color-outline);
  }

  .log-tool {
    color: var(--sys-color-primary);
  }

  .log-error {
    color: var(--sys-color-error);
  }

  /* ---- Metrics ---- */

  .metrics {
    display: flex;
    gap: 12px;
    margin-top: 6px;
    font-size: 0.7rem;
    color: var(--sys-color-outline);
  }

  /* ---- Empty state ---- */

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--sys-color-outline);
    font-size: 0.9rem;
  }
`;
