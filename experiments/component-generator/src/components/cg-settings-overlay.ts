/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<cg-settings-overlay>` — Modal overlay for app-wide settings.
 *
 * Contains toggles for layout tokens and the debug inspector panel,
 * each with a description explaining what they do and why you'd use them.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { appState } from "../state.js";

export { CgSettingsOverlay };

@customElement("cg-settings-overlay")
class CgSettingsOverlay extends SignalWatcher(LitElement) {
  static override styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
    }

    .overlay-card {
      width: 440px;
      background: var(--host-surface-1);
      border: 1px solid var(--host-border);
      border-radius: var(--host-radius-lg);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--host-border);
    }

    .overlay-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--host-text);
    }

    .close-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--host-surface-2);
      border: 1px solid var(--host-border);
      border-radius: var(--host-radius-sm);
      color: var(--host-text-muted);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .close-btn:hover {
      color: var(--host-text);
      background: var(--host-surface-3);
    }

    /* ── Body ── */
    .overlay-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* ── Setting row ── */
    .setting {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .setting-toggle {
      flex: none;
      margin-top: 2px;
    }

    .setting-toggle input {
      accent-color: var(--host-accent);
      cursor: pointer;
      width: 16px;
      height: 16px;
    }

    .setting-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .setting-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--host-text);
      cursor: pointer;
      user-select: none;
    }

    .setting-desc {
      font-size: 12px;
      line-height: 1.5;
      color: var(--host-text-muted);
    }

    .divider {
      height: 1px;
      background: var(--host-border);
    }
  `;

  override render() {
    return html`
      <div class="overlay-card" @click=${this.#stopPropagation}>
        <div class="overlay-header">
          <span class="overlay-title">Settings</span>
          <button class="close-btn" @click=${this.#close}>✕</button>
        </div>

        <div class="overlay-body">
          <label class="setting">
            <span class="setting-toggle">
              <input
                type="checkbox"
                ?checked=${appState.useLayoutTokens}
                @change=${this.#onLayoutToggle}
              />
            </span>
            <span class="setting-info">
              <span class="setting-name">Layout tokens</span>
              <span class="setting-desc">
                Include layout-aware design tokens (columns, max-width, section
                spacing, card direction) in the system prompt. Enables the model
                to generate components that respond to theme-level layout
                changes, not just colors and typography.
              </span>
            </span>
          </label>

          <div class="divider"></div>

          <label class="setting">
            <span class="setting-toggle">
              <input
                type="checkbox"
                ?checked=${appState.inspectorVisible}
                @change=${this.#onDebugToggle}
              />
            </span>
            <span class="setting-info">
              <span class="setting-name">Debug inspector</span>
              <span class="setting-desc">
                Show TweakPane alongside the component preview. Lets you
                live-edit component props and see changes instantly — useful for
                exploring how a generated component responds to different inputs
                without re-generating.
              </span>
            </span>
          </label>
        </div>
      </div>
    `;
  }

  #close() {
    appState.settingsOverlayOpen = false;
  }

  #stopPropagation(e: Event) {
    e.stopPropagation();
  }

  #onLayoutToggle(e: Event) {
    appState.useLayoutTokens = (e.target as HTMLInputElement).checked;
  }

  #onDebugToggle(e: Event) {
    appState.inspectorVisible = (e.target as HTMLInputElement).checked;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cg-settings-overlay": CgSettingsOverlay;
  }
}
