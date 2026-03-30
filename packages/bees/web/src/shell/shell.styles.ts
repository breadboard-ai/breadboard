/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export { styles };

const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--cg-font-sans, "Inter", system-ui, sans-serif);
    color: var(--cg-color-on-surface, #e5e1e6);
    background: var(--cg-color-surface-dim, #1a1b1e);
    overflow: hidden;
  }

  /* ── Header ────────────────────────────────────────────────────── */
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

  /* ── Main Stage ────────────────────────────────────────────────── */
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

  /* ── Empty State ───────────────────────────────────────────────── */
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

  /* ── Status Toast ──────────────────────────────────────────────── */
  .status-toast {
    position: absolute;
    bottom: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--cg-color-surface-container-high, #2b2c31);
    border: 1px solid var(--cg-color-outline-variant, #49454e);
    border-radius: 999px;
    font-size: 12px;
    color: var(--cg-color-on-surface-muted, #9a969e);
    box-shadow:
      0 2px 6px 2px rgba(0, 0, 0, 0.15),
      0 1px 2px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateY(8px);
    transition: all 300ms cubic-bezier(0.2, 0, 0, 1);
    pointer-events: none;
  }

  .status-toast.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--cg-color-outline-variant, #49454e);
    border-top-color: var(--cg-color-primary, #a8c7fa);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Chat FAB ──────────────────────────────────────────────────── */
  .chat-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--cg-color-primary, #a8c7fa);
    color: #1a1b1e;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 4px 8px 3px rgba(0, 0, 0, 0.15),
      0 1px 3px rgba(0, 0, 0, 0.3);
    z-index: 99;
    transition: all 150ms cubic-bezier(0.2, 0, 0, 1);
  }

  .chat-fab:hover {
    transform: scale(1.05);
  }

  .chat-fab .material-symbols-outlined {
    font-size: 24px;
  }

  .chat-fab.hidden {
    transform: scale(0);
    opacity: 0;
    pointer-events: none;
  }

  /* ── Chat Overlay ──────────────────────────────────────────────── */
  .chat-overlay {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 420px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--cg-color-surface-container-lowest, #121316);
    border-top: 1px solid var(--cg-color-outline-variant, #49454e);
    border-left: 1px solid var(--cg-color-outline-variant, #49454e);
    border-radius: 16px 0 0 0;
    box-shadow:
      0 4px 8px 3px rgba(0, 0, 0, 0.15),
      0 1px 3px rgba(0, 0, 0, 0.3);
    z-index: 100;
    transform: translateY(100%);
    transition: transform 300ms cubic-bezier(0.2, 0, 0, 1);
  }

  .chat-overlay.open {
    transform: translateY(0);
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--cg-color-outline-variant, #49454e);
    flex-shrink: 0;
  }

  .chat-title {
    font-size: 14px;
    font-weight: 600;
  }

  .chat-close {
    background: none;
    border: none;
    color: var(--cg-color-on-surface-muted, #9a969e);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 4px;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 200px;
  }

  .chat-msg {
    font-size: 13px;
    line-height: 1.5;
    padding: 12px;
    border-radius: 12px;
    max-width: 90%;
  }

  .chat-msg.agent {
    background: var(--cg-color-surface-container, #232429);
    align-self: flex-start;
    white-space: normal;
  }

  .chat-status-update {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-top: 6px;
    padding-left: 4px;
    font-size: 12px;
    color: var(--cg-color-on-surface-muted, #9a969e);
  }

  .chat-status-update p {
    margin: 0;
  }

  .status-arrow {
    flex-shrink: 0;
    color: var(--cg-color-outline-variant, #49454e);
    font-size: 11px;
  }

  /* Markdown rendered content inside agent messages */
  .chat-msg.agent p {
    margin: 0 0 8px;
  }

  .chat-msg.agent p:last-child {
    margin-bottom: 0;
  }

  .chat-msg.agent ul,
  .chat-msg.agent ol {
    margin: 4px 0 8px;
    padding-left: 20px;
  }

  .chat-msg.agent li {
    margin-bottom: 4px;
  }

  .chat-msg.agent code {
    font-family: var(--cg-font-mono, monospace);
    font-size: 12px;
    background: var(--cg-color-surface-container-high, #2b2c31);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .chat-msg.agent pre {
    background: var(--cg-color-surface-container-high, #2b2c31);
    padding: 8px 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .chat-msg.agent pre code {
    background: none;
    padding: 0;
  }

  .chat-msg.agent strong {
    font-weight: 600;
    color: var(--cg-color-on-surface, #e5e1e6);
  }

  .chat-msg.agent em {
    font-style: italic;
    color: var(--cg-color-on-surface-muted, #9a969e);
  }

  .chat-msg.agent a {
    color: var(--cg-color-primary, #a8c7fa);
    text-decoration: none;
  }

  .chat-msg.agent a:hover {
    text-decoration: underline;
  }

  .chat-msg.user {
    background: var(--cg-color-primary-container, #1b3a5c);
    color: var(--cg-color-on-primary-container, #c3deff);
    align-self: flex-end;
  }

  .chat-msg.thought {
    background: none;
    color: var(--cg-color-on-surface-muted, #9a969e);
    font-size: 12px;
    font-style: italic;
    padding: 4px 12px;
    align-self: flex-start;
  }

  .chat-msg.tool {
    background: none;
    color: var(--cg-color-on-surface-muted, #9a969e);
    font-size: 12px;
    padding: 4px 12px;
    align-self: flex-start;
    font-family: var(--cg-font-mono, monospace);
  }

  .chat-input-area {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--cg-color-outline-variant, #49454e);
    flex-shrink: 0;
  }

  .chat-input-area input {
    flex: 1;
    font-family: inherit;
    font-size: 13px;
    padding: 8px 12px;
    background: var(--cg-color-surface-container-high, #2b2c31);
    color: var(--cg-color-on-surface, #e5e1e6);
    border: 1px solid var(--cg-color-outline-variant, #49454e);
    border-radius: 8px;
    outline: none;
    transition: border-color 150ms;
  }

  .chat-input-area input:focus {
    border-color: var(--cg-color-primary, #a8c7fa);
  }

  .chat-input-area input::placeholder {
    color: var(--cg-color-on-surface-muted, #9a969e);
  }

  .chat-input-area button {
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 16px;
    background: var(--cg-color-primary, #a8c7fa);
    color: #1a1b1e;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 150ms;
  }

  .chat-input-area button:hover {
    opacity: 0.9;
  }

  /* ── Chat Choices ────────────────────────────────────────────────── */
  .chat-choices-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--cg-color-outline-variant, #49454e);
    flex-shrink: 0;
  }

  .chat-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chat-chip {
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--cg-color-outline-variant, #49454e);
    background: var(--cg-color-surface-container-high, #2b2c31);
    color: var(--cg-color-on-surface, #e5e1e6);
    cursor: pointer;
    transition: all 150ms cubic-bezier(0.2, 0, 0, 1);
    white-space: nowrap;
  }

  .chat-chip:hover {
    border-color: var(--cg-color-primary, #a8c7fa);
    background: var(--cg-color-surface-container, #232429);
  }

  .chat-chip.selected {
    background: var(--cg-color-primary-container, #1b3a5c);
    border-color: var(--cg-color-primary, #a8c7fa);
    color: var(--cg-color-on-primary-container, #c3deff);
  }

  .chat-chip-send {
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 16px;
    background: var(--cg-color-primary, #a8c7fa);
    color: #1a1b1e;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    align-self: flex-end;
    transition: opacity 150ms;
  }

  .chat-chip-send:hover {
    opacity: 0.9;
  }

  .chat-chip-send:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* ── Scrollbar ─────────────────────────────────────────────────── */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--cg-color-outline-variant, #49454e);
    border-radius: 3px;
  }

  :focus-visible {
    outline: 2px solid var(--cg-color-primary, #a8c7fa);
    outline-offset: 2px;
  }
`;
