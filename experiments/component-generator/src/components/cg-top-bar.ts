/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<cg-top-bar>` — Persistent top bar across the full app width.
 *
 * **Left**: AIUI logo
 * **Right**: Component-aware controls (theme, code toggle) + Settings + New
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { THEMES } from "../preview/themes.js";
import { appState } from "../state.js";
import { materialSymbols } from "../styles/material-symbols.js";

export { CgTopBar };

@customElement("cg-top-bar")
class CgTopBar extends SignalWatcher(LitElement) {
  static override styles = [
    materialSymbols,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 0 20px;
        height: 48px;
        background: var(--host-surface-1);
        border-bottom: 1px solid var(--host-border);
        flex: none;
      }

      /* ── Logo ── */
      .logo {
        font-size: 18px;
        font-weight: 700;
        color: var(--host-text);
        letter-spacing: -0.02em;
        margin: 0;
        flex: none;
      }
      .logo-accent {
        color: var(--host-accent);
      }

      /* ── Spacer ── */
      .spacer {
        flex: 1;
      }

      /* ── Right side ── */
      .right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: none;
      }

      .control-select {
        padding: 4px 8px;
        background: var(--host-surface-2);
        border: 1px solid var(--host-border);
        border-radius: var(--host-radius-sm);
        color: var(--host-text);
        font-size: 12px;
        font-family: var(--host-font);
        cursor: pointer;
        outline: none;
      }
      .control-select:focus {
        border-color: var(--host-accent-dim);
      }

      .toggle-btn {
        padding: 4px 10px;
        background: var(--host-surface-2);
        border: 1px solid var(--host-border);
        border-radius: var(--host-radius-sm);
        color: var(--host-text-muted);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: var(--host-font-mono);
      }
      .toggle-btn:hover {
        background: var(--host-surface-3);
        color: var(--host-text);
      }
      .toggle-btn.active {
        background: var(--host-accent);
        color: #111;
        border-color: var(--host-accent);
      }

      .icon-btn {
        padding: 4px 8px;
        background: var(--host-surface-2);
        border: 1px solid var(--host-border);
        border-radius: var(--host-radius-sm);
        color: var(--host-text-muted);
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .icon-btn .material-symbols-outlined {
        font-size: 18px;
      }
      .icon-btn:hover {
        background: var(--host-surface-3);
        color: var(--host-text);
      }

      .new-btn {
        padding: 6px 14px;
        background: var(--host-accent);
        border: none;
        border-radius: var(--host-radius-sm);
        color: #111;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: var(--host-font);
        display: flex;
        align-items: center;
        gap: 4px;
        transition: opacity 0.15s;
      }
      .new-btn .material-symbols-outlined {
        font-size: 18px;
      }
      .new-btn:hover {
        opacity: 0.9;
      }
    `,
  ];

  override render() {
    const hasComponent = !!appState.selectedTag;
    const isCodeVisible = appState.codeVisible;

    return html`
      <h1 class="logo">AI<span class="logo-accent">UI</span></h1>

      <div class="spacer"></div>

      <div class="right">
        ${hasComponent
          ? html`
              <select class="control-select" @change=${this.#onThemeChange}>
                ${THEMES.map(
                  (t) => html`
                    <option value=${t.id}>${t.icon} ${t.name}</option>
                  `
                )}
              </select>
              <button
                class="toggle-btn ${isCodeVisible ? "active" : ""}"
                title="View source code"
                @click=${this.#toggleCode}
              >
                { }
              </button>
            `
          : nothing}

        <button class="new-btn" @click=${this.#openOverlay}>
          <span class="material-symbols-outlined">add</span> New
        </button>
        <button class="icon-btn" title="Settings" @click=${this.#openSettings}>
          <span class="material-symbols-outlined">settings</span>
        </button>
      </div>
    `;
  }

  #onThemeChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    this.dispatchEvent(
      new CustomEvent("theme-change", {
        detail: id,
        bubbles: true,
        composed: true,
      })
    );
  }

  #toggleCode() {
    appState.codeVisible = !appState.codeVisible;
  }

  #openOverlay() {
    appState.generationOverlayOpen = true;
  }

  #openSettings() {
    appState.settingsOverlayOpen = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cg-top-bar": CgTopBar;
  }
}
