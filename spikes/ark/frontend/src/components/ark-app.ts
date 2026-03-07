/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { RunStore } from "../state/run-store.js";
import { ViewManager } from "../host/view-manager.js";
import "./ark-prompt.js";
import "./ark-run-card.js";
import "./ark-theme-bar.js";
import "./ark-inspector.js";
import "./ark-skills.js";

export { ArkApp };

type AppMode = "runs" | "skills";

/**
 * Top-level application shell.
 *
 * Three modes:
 * 1. Run list — prompt input + run cards.
 * 2. Viewport — full-screen iframe + inspector sidebar.
 * 3. Skills — skill browser and management.
 */
@customElement("ark-app")
class ArkApp extends SignalWatcher(LitElement) {
  readonly #store = new RunStore();
  #viewManager: ViewManager | null = null;
  @state() private mode: AppMode = "runs";

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #f8f8f8;
      color: #1a1a1a;
      font-family:
        "Inter",
        -apple-system,
        BlinkMacSystemFont,
        sans-serif;
    }

    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      background: #111;
      color: #eee;
      flex-shrink: 0;
    }

    header h1 {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0;
      color: #999;
    }

    .spacer {
      flex: 1;
    }

    .nav-btn {
      border: none;
      background: rgba(255, 255, 255, 0.06);
      color: #888;
      padding: 5px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .nav-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #eee;
    }

    .nav-btn[data-active] {
      background: rgba(255, 255, 255, 0.12);
      color: #eee;
    }

    .back-btn {
      border: none;
      background: rgba(255, 255, 255, 0.08);
      color: #999;
      padding: 5px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #eee;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 0 24px 24px;
    }

    .runs {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 700px;
      margin: 0 auto;
    }

    .empty {
      text-align: center;
      padding: 64px 24px;
      color: #aaa;
      font-size: 15px;
    }

    .empty p {
      margin: 8px 0 0;
      font-size: 13px;
      color: #ccc;
    }

    .loading {
      text-align: center;
      padding: 64px 24px;
      color: #888;
      font-size: 15px;
    }

    /* Viewport mode: iframe + inspector sidebar */
    .viewport-layout {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .viewport {
      flex: 1;
      position: relative;
    }

    .viewport iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Skills panel fills the content area */
    ark-skills {
      flex: 1;
      overflow-y: auto;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.#store.startPolling();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#store.stopPolling();
  }

  override render() {
    const bundle = this.#store.currentBundle.get();
    const loading = this.#store.bundleLoading.get();

    // Full-screen viewport mode.
    if (bundle || loading) {
      return html`
        <header>
          <button class="back-btn" @click=${this.#onBack}>← Back</button>
          <h1>${loading ? "Loading…" : "Ark"}</h1>
        </header>
        ${loading
          ? html`<div class="loading">⏳ Fetching bundle…</div>`
          : html`
              <ark-theme-bar
                @theme-change=${this.#onThemeChange}
              ></ark-theme-bar>
              <div class="viewport-layout">
                <div class="viewport"></div>
                <ark-inspector .bundle=${bundle}></ark-inspector>
              </div>
            `}
      `;
    }

    // Normal modes: runs or skills.
    return html`
      <header>
        <h1>Ark</h1>
        <div class="spacer"></div>
        <button
          class="nav-btn"
          ?data-active=${this.mode === "runs"}
          @click=${() => (this.mode = "runs")}
        >
          Runs
        </button>
        <button
          class="nav-btn"
          ?data-active=${this.mode === "skills"}
          @click=${() => (this.mode = "skills")}
        >
          Skills
        </button>
      </header>

      ${this.mode === "skills"
        ? html`<ark-skills></ark-skills>`
        : this.#renderRunList()}
    `;
  }

  #renderRunList() {
    const runs = this.#store.runs.get();

    return html`
      <ark-prompt @start-run=${this.#onStartRun}></ark-prompt>

      <div class="content">
        ${runs.length === 0
          ? html`
              <div class="empty">
                ✨ No runs yet
                <p>Type an objective above and click Generate</p>
              </div>
            `
          : html`
              <div class="runs">
                ${runs.map(
                  (run) => html`
                    <ark-run-card
                      .run=${run}
                      @open-bundle=${this.#onOpenBundle}
                      @delete-run=${this.#onDeleteRun}
                    ></ark-run-card>
                  `
                )}
              </div>
            `}
      </div>
    `;
  }

  override updated() {
    // When bundle is set and viewport is in the DOM, mount the ViewManager.
    const bundle = this.#store.currentBundle.get();
    const viewport = this.shadowRoot?.querySelector(".viewport");
    if (bundle && viewport && !this.#viewManager) {
      this.#viewManager = new ViewManager(viewport as HTMLElement);
      // loadBundle renders the first view automatically.
      this.#viewManager.loadBundle(bundle);
    }
  }

  async #onStartRun(e: CustomEvent<{ objective: string }>) {
    await this.#store.startRun(e.detail.objective);
  }

  async #onOpenBundle(e: CustomEvent<{ id: string }>) {
    await this.#store.openBundle(e.detail.id);
  }

  #onBack() {
    if (this.#viewManager) {
      this.#viewManager.destroy();
      this.#viewManager = null;
    }
    this.#store.closeBundle();
  }

  #onThemeChange(e: CustomEvent<{ css: string }>) {
    this.#viewManager?.applyTheme(e.detail.css);
  }

  async #onDeleteRun(e: CustomEvent<{ id: string }>) {
    await this.#store.deleteRun(e.detail.id);
  }
}
