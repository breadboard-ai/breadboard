/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<cg-app>` — Top-level application shell.
 *
 * Layout: top bar (full width) + body (sidebar + preview).
 * Conditionally renders the generation and settings overlays.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { appState } from "../state.js";

import "./cg-top-bar.js";
import "./cg-sidebar.js";
import "./cg-preview.js";
import "./cg-generation-overlay.js";
import "./cg-settings-overlay.js";

@customElement("cg-app")
export class CgApp extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr;
      grid-template-columns: 280px 1fr;
      height: 100vh;
      overflow: hidden;
    }

    cg-top-bar {
      grid-column: 1 / -1;
    }

    cg-sidebar {
      grid-column: 1;
      grid-row: 2;
    }

    cg-preview {
      grid-column: 2;
      grid-row: 2;
    }
  `;

  override render() {
    return html`
      <cg-top-bar @theme-change=${this.#onThemeChange}></cg-top-bar>
      <cg-sidebar></cg-sidebar>
      <cg-preview></cg-preview>
      ${appState.generationOverlayOpen
        ? html`<cg-generation-overlay></cg-generation-overlay>`
        : nothing}
      ${appState.settingsOverlayOpen
        ? html`<cg-settings-overlay></cg-settings-overlay>`
        : nothing}
    `;
  }

  /**
   * Forward theme-change events from the top bar to the preview.
   * The preview needs the theme ID to update iframe styles.
   */
  #onThemeChange(e: CustomEvent<string>) {
    const preview = this.renderRoot.querySelector("cg-preview");
    if (preview) {
      preview.dispatchEvent(
        new CustomEvent("theme-change", {
          detail: e.detail,
          bubbles: false,
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cg-app": CgApp;
  }
}
