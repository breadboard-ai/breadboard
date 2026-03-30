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

  /* ── Status View (Empty State) ─────────────────────────────────── */

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

  /* ── Spinner (shared) ─────────────────────────────────────────── */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--cg-color-outline-variant, #49454e);
    border-top-color: var(--cg-color-primary, #a8c7fa);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .pulse-spinner {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }

  .pulse-bar-spinner {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Pulse Hero (empty state) ───────────────────────────────── */
  .pulse-hero {
    font-size: 16px;
    max-width: 480px;
    text-align: center;
    line-height: 1.6;
    color: var(--cg-color-on-surface, #e5e1e6);
  }

  /* ── Pulse Bar ──────────────────────────────────────────────── */
  .pulse-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 48px;
    background: var(--cg-color-surface-container-lowest, #121316);
    border-top: 1px solid var(--cg-color-outline-variant, #49454e);
    flex-shrink: 0;
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

  /* ── Chat Overlay ──────────────────────────────────────────────── */
  .chat-overlay {
    position: fixed;
    bottom: 48px;
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

  /* ── Chat Body (rail + messages) ──────────────────────────────── */
  .chat-body {
    display: flex;
    flex: 1;
    overflow: hidden;
    min-height: 200px;
  }

  /* ── Thread Rail ──────────────────────────────────────────────── */
  .thread-rail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 4px;
    width: 100px;
    flex-shrink: 0;
    border-right: 1px solid var(--cg-color-outline-variant, #49454e);
    overflow-y: auto;
  }

  .thread-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--cg-color-on-surface-muted, #9a969e);
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 150ms cubic-bezier(0.2, 0, 0, 1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .thread-item:hover {
    background: var(--cg-color-surface-container, #232429);
    color: var(--cg-color-on-surface, #e5e1e6);
  }

  .thread-item.active {
    background: var(--cg-color-surface-container-high, #2b2c31);
    color: var(--cg-color-on-surface, #e5e1e6);
    font-weight: 600;
  }

  .thread-item-title {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .thread-unread {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--cg-color-primary, #a8c7fa);
    flex-shrink: 0;
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

  /* Markdown rendered content inside chat messages */
  .chat-msg p {
    margin: 0 0 8px;
  }

  .chat-msg p:last-child {
    margin-bottom: 0;
  }

  .chat-msg ul,
  .chat-msg ol {
    margin: 4px 0 8px;
    padding-left: 20px;
  }

  .chat-msg li {
    margin-bottom: 4px;
  }

  .chat-msg code {
    font-family: var(--cg-font-mono, monospace);
    font-size: 12px;
    background: rgba(0, 0, 0, 0.2);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .chat-msg pre {
    background: rgba(0, 0, 0, 0.2);
    padding: 8px 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .chat-msg pre code {
    background: none;
    padding: 0;
  }

  .chat-msg strong {
    font-weight: 600;
    color: inherit;
  }

  .chat-msg em {
    font-style: italic;
    opacity: 0.8;
  }

  .chat-msg a {
    color: var(--cg-color-primary, #a8c7fa);
    text-decoration: none;
  }

  .chat-msg a:hover {
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

  .chat-msg.error {
    background: var(--cg-color-error-container, #93000a);
    color: var(--cg-color-on-error-container, #ffdad6);
    font-size: 13px;
    padding: 10px 14px;
    border-radius: 12px;
    align-self: flex-start;
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
