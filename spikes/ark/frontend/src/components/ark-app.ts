/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { RunStore } from "../state/run-store.js";
import { JourneyStore } from "../state/journey-store.js";
import { ViewManager } from "../host/view-manager.js";
import { backend, type JourneySummary, type JourneyStatus } from "../services/backend.js";
import "./ark-prompt.js";
import "./ark-run-card.js";
import "./ark-theme-bar.js";
import "./ark-inspector.js";
import "./ark-skills.js";

export { ArkApp };

type AppMode = "runs" | "journeys" | "skills";

/**
 * Top-level application shell.
 *
 * Four modes:
 * 1. Run list — prompt input + run cards (legacy single-shot generation).
 * 2. Journey list — multi-step journeys with round-trip routing.
 * 3. Viewport — full-screen iframe + inspector sidebar.
 * 4. Skills — skill browser and management.
 */
@customElement("ark-app")
class ArkApp extends SignalWatcher(LitElement) {
  readonly #runStore = new RunStore();
  readonly #journeyStore = new JourneyStore();
  #viewManager: ViewManager | null = null;
  @state() private mode: AppMode = "journeys";
  @state() private themeCss = "";

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

    /* Journey cards */
    .journey-card {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 16px 20px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .journey-card:hover {
      border-color: #ccc;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    .journey-card h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 6px;
      color: #1a1a1a;
    }

    .journey-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: #888;
    }

    .journey-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .journey-status[data-status="active"] {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .journey-status[data-status="processing"] {
      background: #fff3e0;
      color: #e65100;
    }

    .journey-status[data-status="complete"] {
      background: #e3f2fd;
      color: #1565c0;
    }

    .journey-status[data-status="planning"],
    .journey-status[data-status="generating"] {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    .journey-status[data-status="error"] {
      background: #ffebee;
      color: #c62828;
    }

    .journey-delete {
      border: none;
      background: none;
      color: #ccc;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: auto;
    }

    .journey-delete:hover {
      background: #fee;
      color: #c00;
    }

    /* Processing indicator in viewport */
    .processing-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      background: var(--cg-color-surface, #f8f8f8);
      color: var(--cg-color-on-surface-muted, #666);
      font-size: 15px;
    }

    .processing-indicator .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--cg-color-outline, rgba(0, 0, 0, 0.08));
      border-top-color: var(--cg-color-on-surface-muted, #666);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Journey completion view */
    .completion-view {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 24px;
      padding: 40px;
      background: var(--cg-color-surface, #f8f8f8);
      color: var(--cg-color-on-surface, #1a1a1a);
    }

    .completion-view .completion-icon {
      font-size: 48px;
    }

    .completion-view h2 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }

    .completion-view .outcome {
      max-width: 480px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .completion-view .outcome-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--cg-color-surface-container, #f0f0f0);
      border-radius: 8px;
      font-size: 14px;
    }

    .completion-view .outcome-key {
      color: var(--cg-color-on-surface-muted, #666);
      text-transform: capitalize;
    }

    .completion-view .outcome-value {
      font-weight: 600;
    }

    .completion-view .done-btn {
      border: none;
      background: var(--cg-color-primary, #333);
      color: var(--cg-color-on-primary, #fff);
      padding: 10px 28px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      margin-top: 8px;
      transition: opacity 0.15s;
    }

    .completion-view .done-btn:hover {
      opacity: 0.85;
    }

    /* Journey error view */
    .error-view {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 20px;
      padding: 40px;
      background: var(--cg-color-surface, #f8f8f8);
      color: var(--cg-color-on-surface, #1a1a1a);
      text-align: center;
    }

    .error-view .error-icon {
      font-size: 40px;
    }

    .error-view .error-message {
      font-size: 15px;
      color: var(--cg-color-on-surface-muted, #666);
      max-width: 400px;
    }

    .error-view .retry-btn {
      border: none;
      background: var(--cg-color-primary, #333);
      color: var(--cg-color-on-primary, #fff);
      padding: 10px 28px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.15s;
    }

    .error-view .retry-btn:hover {
      opacity: 0.85;
    }

    /* Journey progress bar in header */
    .journey-progress {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #999;
    }

    .step-dots {
      display: flex;
      gap: 4px;
    }

    .step-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #444;
    }

    .step-dot[data-active] {
      background: #4caf50;
    }

    .step-dot[data-done] {
      background: #888;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.#runStore.startPolling();
    this.#journeyStore.loadJourneys();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#runStore.stopPolling();
  }

  override render() {
    // Journey viewport mode.
    const journeyBundle = this.#journeyStore.currentBundle.get();
    const journeyLoading = this.#journeyStore.bundleLoading.get();
    const journeyProcessing = this.#journeyStore.processing.get();
    const journeyStatus = this.#journeyStore.activeStatus.get();

    const journeyCompleted = this.#journeyStore.completed.get();
    const journeyError = journeyStatus?.status === "error" && !journeyProcessing;

    if (journeyBundle || journeyLoading || journeyProcessing || journeyCompleted || journeyError) {
      // Remap :root → :host so theme tokens resolve in shadow DOM.
      const hostThemeCss = this.themeCss
        ? html`<style>${this.themeCss.replace(/:root/g, ":host")}</style>`
        : nothing;

      return html`
        ${hostThemeCss}
        <header>
          <button class="back-btn" @click=${this.#onJourneyBack}>← Back</button>
          <h1>${journeyLoading ? "Loading…" : journeyStatus?.progress.label ?? "Journey"}</h1>
          ${journeyStatus && journeyStatus.progress.total > 0 ? this.#renderProgressDots(journeyStatus.progress) : nothing}
        </header>
        ${journeyError
          ? html`
              <div class="error-view">
                <span class="error-icon">⚠️</span>
                <p class="error-message">${journeyStatus!.progress.label}</p>
                <button class="retry-btn" @click=${this.#onRetry}>Retry</button>
              </div>
            `
          : journeyCompleted
            ? this.#renderJourneyCompletion(journeyStatus)
            : journeyLoading
              ? html`<div class="loading">⏳ Fetching view…</div>`
              : journeyProcessing
                ? html`
                    <ark-theme-bar
                      @theme-change=${this.#onThemeChange}
                    ></ark-theme-bar>
                    <div class="processing-indicator">
                      <div class="spinner"></div>
                      <span>${journeyStatus?.progress.label ?? "Working on it…"}</span>
                    </div>
                  `
                : html`
                    <ark-theme-bar
                      @theme-change=${this.#onThemeChange}
                    ></ark-theme-bar>
                    <div class="viewport-layout">
                      <div class="viewport"></div>
                    </div>
                  `}
      `;
    }

    // Run viewport mode (legacy).
    const runBundle = this.#runStore.currentBundle.get();
    const runLoading = this.#runStore.bundleLoading.get();

    if (runBundle || runLoading) {
      return html`
        <header>
          <button class="back-btn" @click=${this.#onRunBack}>← Back</button>
          <h1>${runLoading ? "Loading…" : "Ark"}</h1>
        </header>
        ${runLoading
          ? html`<div class="loading">⏳ Fetching bundle…</div>`
          : html`
              <ark-theme-bar
                @theme-change=${this.#onThemeChange}
              ></ark-theme-bar>
              <div class="viewport-layout">
                <div class="viewport"></div>
                <ark-inspector .bundle=${runBundle}></ark-inspector>
              </div>
            `}
      `;
    }

    // Normal modes: journeys, runs, or skills.
    return html`
      <header>
        <h1>Ark</h1>
        <div class="spacer"></div>
        <button
          class="nav-btn"
          ?data-active=${this.mode === "journeys"}
          @click=${() => (this.mode = "journeys")}
        >
          Journeys
        </button>
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
        : this.mode === "journeys"
          ? this.#renderJourneyList()
          : this.#renderRunList()}
    `;
  }

  #renderProgressDots(progress: { current: number; total: number }) {
    const dots = [];
    for (let i = 0; i < progress.total; i++) {
      dots.push(html`
        <div
          class="step-dot"
          ?data-active=${i === progress.current}
          ?data-done=${i < progress.current}
        ></div>
      `);
    }
    return html`
      <div class="journey-progress">
        <div class="step-dots">${dots}</div>
        <span>${progress.current + 1} / ${progress.total}</span>
      </div>
    `;
  }

  #renderJourneyList() {
    const journeys = this.#journeyStore.journeys.get();

    return html`
      <ark-prompt @start-run=${this.#onStartJourney}></ark-prompt>

      <div class="content">
        ${journeys.length === 0
          ? html`
              <div class="empty">
                ✨ No journeys yet
                <p>Type an objective above to start a multi-step journey</p>
              </div>
            `
          : html`
              <div class="runs">
                ${journeys.map(
                  (j) => html`
                    <div class="journey-card" @click=${() => this.#onOpenJourney(j)}>
                      <h3>${j.objective}</h3>
                      <div class="journey-meta">
                        <span
                          class="journey-status"
                          data-status=${j.status}
                        >
                          ${j.status === "active"
                            ? "● Active"
                            : j.status === "processing"
                              ? "◐ Processing"
                              : "✓ Complete"}
                        </span>
                        <span>Step ${j.progress.current + 1} of ${j.progress.total}</span>
                        <button
                          class="journey-delete"
                          @click=${(e: Event) => {
                            e.stopPropagation();
                            this.#journeyStore.deleteJourney(j.id);
                          }}
                        >×</button>
                      </div>
                    </div>
                  `
                )}
              </div>
            `}
      </div>
    `;
  }

  #renderRunList() {
    const runs = this.#runStore.runs.get();

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
    const viewport = this.shadowRoot?.querySelector(".viewport");

    // If the viewport was removed (e.g. switched to processing spinner),
    // clean up the old ViewManager so a fresh one is created for the next step.
    if (!viewport && this.#viewManager) {
      this.#viewManager = null;
    }

    // Journey viewport: mount ViewManager with emit routing.
    const journeyBundle = this.#journeyStore.currentBundle.get();
    if (journeyBundle && viewport && !this.#viewManager) {
      this.#viewManager = new ViewManager(viewport as HTMLElement, {
        onEvent: (event: string, payload?: unknown) => {
          console.log(`[ark-app] Journey emit: "${event}"`, payload);
          // Route the result back to the journey store.
          this.#journeyStore.submitResult(
            (payload as Record<string, unknown>) ?? {}
          );
        },
      });
      this.#viewManager.loadBundle(journeyBundle);
      return;
    }

    // Run viewport: mount ViewManager (legacy, no emit routing).
    const runBundle = this.#runStore.currentBundle.get();
    if (runBundle && viewport && !this.#viewManager) {
      this.#viewManager = new ViewManager(viewport as HTMLElement);
      this.#viewManager.loadBundle(runBundle);
    }
  }

  // ─── Journey handlers ─────────────────────────────────────────────

  async #onStartJourney(e: CustomEvent<{ objective: string }>) {
    await this.#journeyStore.startJourney(e.detail.objective);
  }

  async #onOpenJourney(j: JourneySummary) {
    if (j.status === "complete") {
      // Show the completion view for finished journeys.
      const status = await backend.getJourneyStatus(j.id);
      this.#journeyStore.activeJourneyId.set(j.id);
      this.#journeyStore.activeStatus.set(status);
      this.#journeyStore.completed.set(true);
      return;
    }
    if (j.status === "error") {
      // Show the error view so the user can retry.
      const status = await backend.getJourneyStatus(j.id);
      this.#journeyStore.activeJourneyId.set(j.id);
      this.#journeyStore.activeStatus.set(status);
      return;
    }
    await this.#journeyStore.openJourney(j.id);
  }

  #renderJourneyCompletion(status: JourneyStatus | null) {
    const context = status?.context ?? {};
    const entries = Object.entries(context).filter(
      ([, v]) => v !== null && v !== "" && v !== undefined
    );

    return html`
      <div class="completion-view">
        <span class="completion-icon">✨</span>
        <h2>Journey Complete</h2>
        <p style="margin:0;opacity:0.7">${status?.objective ?? ""}</p>
        ${entries.length > 0
          ? html`
            <div class="outcome">
              ${entries.map(([key, value]) => html`
                <div class="outcome-item">
                  <span class="outcome-key">${key.replace(/_/g, " ")}</span>
                  <span class="outcome-value">${String(value)}</span>
                </div>
              `)}
            </div>`
          : nothing}
        <button class="done-btn" @click=${this.#onJourneyBack}>Done</button>
      </div>
    `;
  }

  #onRetry() {
    this.#journeyStore.retryJourney();
  }

  #onJourneyBack() {
    if (this.#viewManager) {
      this.#viewManager.destroy();
      this.#viewManager = null;
    }
    this.#journeyStore.closeJourney();
    // Refresh the list so the journey appears.
    this.#journeyStore.loadJourneys();
  }

  // ─── Run handlers (legacy) ────────────────────────────────────────

  async #onStartRun(e: CustomEvent<{ objective: string }>) {
    await this.#runStore.startRun(e.detail.objective);
  }

  async #onOpenBundle(e: CustomEvent<{ id: string }>) {
    await this.#runStore.openBundle(e.detail.id);
  }

  #onRunBack() {
    if (this.#viewManager) {
      this.#viewManager.destroy();
      this.#viewManager = null;
    }
    this.#runStore.closeBundle();
  }

  #onThemeChange(e: CustomEvent<{ css: string }>) {
    this.themeCss = e.detail.css;
    this.#viewManager?.applyTheme(e.detail.css);
  }

  async #onDeleteRun(e: CustomEvent<{ id: string }>) {
    await this.#runStore.deleteRun(e.detail.id);
  }
}
