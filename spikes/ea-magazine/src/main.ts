/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import MarkdownIt from "markdown-it";
import {
  generate,
  generateDesignFirst,
  type GenerateResult,
} from "./pipeline.js";
import { formatPlaybooksForPrompt } from "./data.js";
import { Telemetry, type RunRecord } from "./telemetry.js";
import {
  themes,
  themeNames,
  getThemePrompt,
  getThemeCss,
  UNIVERSAL_GUIDANCE,
  type ThemeName,
} from "./themes.js";

export { EaMagazineApp };

type Mode = "one-shot" | "prefab" | "design-first";
type GeminiModel = "gemini-3.1-pro-preview" | "gemini-3.1-flash-lite-preview";
const MODEL_LABELS: Record<GeminiModel, string> = {
  "gemini-3.1-pro-preview": "3.1 Pro",
  "gemini-3.1-flash-lite-preview": "3.1 Flash",
};

@customElement("ea-magazine-app")
class EaMagazineApp extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        sans-serif;
      color: #1c1b1a;
    }

    .g-icon {
      font-family: "Material Symbols Outlined";
      font-weight: normal;
      font-style: normal;
      font-size: 18px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: "liga";
    }

    /* ─── Control Bar ───────────────────────────────────────────── */

    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e6e3de;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      flex-shrink: 0;
    }

    .control-group {
      display: flex;
      gap: 2px;
      background: #efece8;
      border-radius: 8px;
      padding: 2px;
    }

    .mode-btn {
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: transparent;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      color: #7a7672;
      transition: all 150ms ease;
    }

    .mode-btn[data-active] {
      background: #ffffff;
      color: #1c1b1a;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    }

    .generate-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 20px;
      border: none;
      border-radius: 9999px;
      background: #1c1b1a;
      color: #ffffff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 150ms ease;
    }

    .model-select {
      padding: 6px 10px;
      border: 1px solid #e6e3de;
      border-radius: 6px;
      background: #ffffff;
      font-size: 12px;
      font-weight: 500;
      color: #1c1b1a;
      cursor: pointer;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #7a7672;
      cursor: pointer;
      user-select: none;
    }

    .toggle-label input {
      accent-color: #1c1b1a;
    }

    .generate-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .generate-btn .g-icon {
      font-size: 18px;
    }

    .timing {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #7a7672;
      margin-left: auto;
    }

    .timing-label {
      background: #efece8;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 500;
      font-size: 11px;
      text-transform: capitalize;
    }

    .timing-value {
      font-weight: 500;
      color: #1c1b1a;
    }

    .timing-detail {
      color: #a09c98;
    }

    .history-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid #e6e3de;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      color: #7a7672;
      transition: all 150ms ease;
    }

    .history-btn:hover {
      background: #f5f3f0;
      color: #1c1b1a;
    }

    .history-btn .g-icon {
      font-size: 18px;
    }

    /* ─── Frame Container ───────────────────────────────────────── */

    .frame-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: #f5f3f0;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    /* ─── Loading ───────────────────────────────────────────────── */

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      height: 100%;
      color: #7a7672;
      font-size: 14px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e6e3de;
      border-top-color: #1c1b1a;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner-small {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .stream-preview {
      max-width: 600px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 12px;
      font-family: "SF Mono", SFMono-Regular, ui-monospace, Menlo, monospace;
      color: #a09c98;
      white-space: pre-wrap;
      word-break: break-word;
      padding: 0 24px;
      text-align: center;
    }

    .stage-label {
      font-weight: 500;
      color: #1c1b1a;
      font-size: 13px;
    }

    /* ─── Error ─────────────────────────────────────────────────── */

    .error {
      padding: 24px;
      margin: 24px;
      background: #ffdad6;
      color: #410002;
      border-radius: 12px;
      font-size: 14px;
      white-space: pre-wrap;
    }

    /* ─── History Panel ─────────────────────────────────────────── */

    .history-panel {
      position: fixed;
      top: 56px;
      right: 16px;
      width: 520px;
      max-height: 70vh;
      overflow-y: auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.08),
        0 2px 6px rgba(0, 0, 0, 0.04);
      z-index: 100;
    }

    .history-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #e6e3de;
      font-size: 13px;
      font-weight: 500;
    }

    .history-clear {
      border: none;
      background: none;
      color: #c06b84;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
    }

    .history-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .history-table th {
      text-align: left;
      padding: 6px 8px;
      font-weight: 500;
      color: #7a7672;
      border-bottom: 1px solid #e6e3de;
      white-space: nowrap;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .history-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #f5f3f0;
      white-space: nowrap;
    }

    .history-table tr {
      cursor: pointer;
      transition: background 100ms ease;
    }

    .history-table tbody tr:hover {
      background: #f5f3f0;
    }

    .history-mode {
      background: #efece8;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 500;
      font-size: 11px;
      text-transform: capitalize;
    }

    .history-muted {
      color: #a09c98;
    }

    .history-bold {
      font-weight: 600;
    }

    .history-replay {
      opacity: 0.3;
      transition: opacity 150ms ease;
    }

    .history-table tbody tr:hover .history-replay {
      opacity: 1;
    }

    .history-replay .g-icon {
      font-size: 16px;
      color: #7a7672;
    }

    /* ─── Source Viewer ─────────────────────────────────────────── */

    .source-viewer {
      position: fixed;
      top: 56px;
      right: 16px;
      width: 480px;
      max-height: 70vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 12px;
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.08),
        0 2px 6px rgba(0, 0, 0, 0.04);
      z-index: 100;
    }

    /* ─── Context Viewer ────────────────────────────────────────── */

    .context-viewer {
      position: fixed;
      top: 56px;
      right: 16px;
      width: 520px;
      max-height: 70vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 12px;
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.08),
        0 2px 6px rgba(0, 0, 0, 0.04);
      z-index: 100;
    }

    .context-content {
      flex: 1;
      overflow: auto;
      padding: 12px 16px;
      font-size: 13px;
      line-height: 1.5;
      color: #1c1b1a;
    }

    .context-content h1,
    .context-content h2,
    .context-content h3 {
      font-size: 13px;
      font-weight: 600;
      margin: 12px 0 4px;
    }

    .context-content p {
      margin: 4px 0;
    }

    .context-content ul,
    .context-content ol {
      margin: 4px 0;
      padding-left: 20px;
    }

    .context-content code {
      font-family: "SF Mono", SFMono-Regular, ui-monospace, Menlo, monospace;
      font-size: 11px;
      background: #f5f3f0;
      padding: 1px 4px;
      border-radius: 3px;
    }

    .context-content pre {
      background: #f5f3f0;
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 11px;
    }

    .context-section {
      margin-bottom: 16px;
    }

    .context-section-title {
      font-family: system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #7a7672;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e6e3de;
    }

    .source-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid #e6e3de;
      font-size: 13px;
      font-weight: 500;
      flex-shrink: 0;
    }

    .source-close {
      margin-left: auto;
      border: none;
      background: none;
      cursor: pointer;
      color: #7a7672;
      padding: 0;
      display: flex;
    }

    .source-tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid #e6e3de;
      overflow-x: auto;
      flex-shrink: 0;
    }

    .source-tab {
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 500;
      font-family: "SF Mono", SFMono-Regular, ui-monospace, Menlo, monospace;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #7a7672;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
    }

    .source-tab[data-active] {
      color: #1c1b1a;
      border-bottom-color: #1c1b1a;
    }

    .source-code {
      flex: 1;
      overflow: auto;
      padding: 12px 16px;
      font-family: "SF Mono", SFMono-Regular, ui-monospace, Menlo, monospace;
      font-size: 11px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      color: #1c1b1a;
    }
  `;

  @state() private mode: Mode = "one-shot";
  @state() private geminiModel: GeminiModel = "gemini-3.1-pro-preview";
  @state() private theme: ThemeName = "editorial";
  @state() private imageModel: "nb-pro" | "nb-2" = "nb-pro";
  @state() private allowCustomComponents = true;
  @state() private themeAwareLayout = true;
  @state() private generating = false;
  @state() private streamText = "";
  @state() private stageLabel = "";
  @state() private errorMessage = "";
  @state() private showHistory = false;
  @state() private showSource = false;
  @state() private showContext = false;
  @state() private lastRun: RunRecord | null = null;
  @state() private iframeReady = false;

  // Source viewer state
  @state() private sourceFiles: Record<string, string> | null = null;
  @state() private sourceActiveFile = "";
  @state() private sourceRunId = "";

  private telemetry = new Telemetry();
  private uiSkillText = "";
  private skillText = "";
  private prefabText = "";
  private personaText = "";
  private iframeEl: HTMLIFrameElement | null = null;

  override connectedCallback() {
    super.connectedCallback();

    // Inject font stylesheet into shadow root (constructable stylesheets
    // don't support @import).
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap";
    this.shadowRoot?.prepend(link);

    this.#loadAssets();
  }

  async #loadAssets() {
    const [uiSkill, skill, prefab, persona] = await Promise.all([
      fetch("/ui-skill.md").then((r) => r.text()),
      fetch("/skill.md").then((r) => r.text()),
      fetch("/prefab.md").then((r) => r.text()),
      fetch("/persona.md").then((r) => r.text()),
    ]);
    this.uiSkillText = uiSkill;
    this.skillText = skill;
    this.prefabText = prefab;
    this.personaText = persona;

    // Expose __dump for console analysis
    (window as unknown as Record<string, unknown>).__dump = () => {
      const runs = this.telemetry.runs.map((run) => {
        const files = this.telemetry.getFiles(run.id);
        const code = this.telemetry.getCode(run.id);
        return { ...run, code, files };
      });
      return {
        runs,
        markdown: this.#telemetryToMarkdown(),
      };
    };
  }

  override render() {
    const display = this.lastRun ?? this.telemetry.runs[0];

    return html`
      <div class="controls">
        <div class="control-group">
          ${(["one-shot", "prefab", "design-first"] as Mode[]).map(
            (m) => html`
              <button
                class="mode-btn"
                ?data-active=${m === this.mode}
                @click=${() => (this.mode = m)}
              >
                ${m}
              </button>
            `
          )}
        </div>

        <select
          class="model-select"
          .value=${this.geminiModel}
          @change=${(e: Event) =>
            (this.geminiModel = (e.target as HTMLSelectElement)
              .value as GeminiModel)}
        >
          ${(Object.keys(MODEL_LABELS) as GeminiModel[]).map(
            (m) => html`<option value=${m}>${MODEL_LABELS[m]}</option>`
          )}
        </select>

        <select
          class="model-select"
          .value=${this.theme}
          @change=${(e: Event) => {
            this.theme = (e.target as HTMLSelectElement).value as ThemeName;
            // Push theme CSS to live iframe immediately
            if (this.iframeEl?.contentWindow) {
              const css = getThemeCss(this.theme);
              this.iframeEl.contentWindow.postMessage(
                { type: "update-theme", css },
                "*"
              );
            }
          }}
        >
          ${themeNames.map(
            (t) => html`<option value=${t}>${themes[t].label}</option>`
          )}
        </select>

        ${this.mode === "design-first"
          ? html`
              <select
                class="model-select"
                .value=${this.imageModel}
                @change=${(e: Event) =>
                  (this.imageModel = (e.target as HTMLSelectElement).value as
                    | "nb-pro"
                    | "nb-2")}
              >
                <option value="nb-pro">NB Pro</option>
                <option value="nb-2">NB 2</option>
              </select>
            `
          : nothing}
        ${this.mode === "prefab"
          ? html`
              <label class="toggle-label">
                <input
                  type="checkbox"
                  .checked=${this.allowCustomComponents}
                  @change=${(e: Event) =>
                    (this.allowCustomComponents = (
                      e.target as HTMLInputElement
                    ).checked)}
                />
                Allow custom components
              </label>
            `
          : nothing}

        <label class="toggle-label">
          <input
            type="checkbox"
            .checked=${this.themeAwareLayout}
            @change=${(e: Event) =>
              (this.themeAwareLayout = (e.target as HTMLInputElement).checked)}
          />
          Theme-aware layout
        </label>

        <button
          class="generate-btn"
          ?disabled=${this.generating}
          @click=${this.#handleGenerate}
        >
          ${this.generating
            ? html`<span class="spinner-small"></span> Generating…`
            : html`<span class="g-icon">auto_awesome</span> Generate`}
        </button>

        ${display ? this.#renderTiming(display) : nothing}
        ${this.sourceFiles
          ? html`
              <button
                class="history-btn"
                title="View generated source"
                @click=${() => (this.showSource = !this.showSource)}
              >
                <span class="g-icon">code</span>
              </button>
            `
          : nothing}
        <button
          class="history-btn"
          title="Open in new tab (for full-page screenshots)"
          @click=${() => {
            const doc = this.iframeEl?.contentDocument;
            if (!doc) return;
            const clone = doc.documentElement.cloneNode(true) as HTMLElement;
            // Inject <base> so relative URLs resolve against the dev server
            const base = doc.createElement("base");
            base.href = window.location.origin + "/";
            const head = clone.querySelector("head");
            if (head) head.prepend(base);
            const blob = new Blob(
              [`<!DOCTYPE html>\n${clone.outerHTML}`],
              { type: "text/html" }
            );
            window.open(URL.createObjectURL(blob), "_blank");
          }}
        >
          <span class="g-icon">open_in_new</span>
        </button>
        <button
          class="history-btn"
          title="View model context"
          @click=${() => (this.showContext = !this.showContext)}
        >
          <span class="g-icon">visibility</span>
        </button>
        ${this.telemetry.runs.length > 0
          ? html`
              <button
                class="history-btn"
                title="${this.telemetry.runs.length} past runs"
                @click=${() => (this.showHistory = !this.showHistory)}
              >
                <span class="g-icon">history</span>
              </button>
            `
          : nothing}
      </div>

      <div class="frame-container">
        ${this.generating
          ? html`
              <div class="loading">
                <div class="spinner"></div>
                ${this.stageLabel
                  ? html`<span class="stage-label">${this.stageLabel}</span>`
                  : nothing}
                <span>Generating ${this.mode} layout…</span>
                <div class="stream-preview">${this.streamText}</div>
              </div>
            `
          : this.errorMessage
            ? html`<div class="error">${this.errorMessage}</div>`
            : this.iframeReady
              ? html`<iframe
                  src="/iframe.html"
                  sandbox="allow-scripts allow-same-origin"
                  @load=${this.#onIframeLoad}
                ></iframe>`
              : nothing}
      </div>

      ${this.showHistory ? this.#renderHistoryPanel() : nothing}
      ${this.showSource && this.sourceFiles
        ? this.#renderSourceViewer()
        : nothing}
      ${this.showContext ? this.#renderContextViewer() : nothing}
    `;
  }

  #renderTiming(run: RunRecord) {
    return html`
      <div class="timing">
        <span class="timing-label">${run.mode}</span>
        <span class="timing-value">
          ${(run.totalTimeMs / 1000).toFixed(1)}s total
        </span>
        <span class="timing-detail">
          ${run.outputFileCount} files ·
          ${(run.outputTotalChars / 1000).toFixed(1)}k chars
        </span>
        ${run.stageTimes
          ? html`
              <span class="timing-detail">
                (assess ${(run.stageTimes.assessMs / 1000).toFixed(1)}s · design
                ${(run.stageTimes.designMs / 1000).toFixed(1)}s · gen
                ${(run.stageTimes.generateMs / 1000).toFixed(1)}s)
              </span>
            `
          : nothing}
      </div>
    `;
  }

  #renderHistoryPanel() {
    return html`
      <div class="history-panel">
        <div class="history-header">
          <span>Run History</span>
          <span style="flex: 1"></span>
          <button
            class="source-close"
            title="Copy telemetry as markdown"
            @click=${this.#copyTelemetryMarkdown}
          >
            <span class="g-icon">content_copy</span>
          </button>
          <button
            class="history-clear"
            @click=${() => {
              this.telemetry.clearAll();
              this.showHistory = false;
              this.lastRun = null;
              this.sourceFiles = null;
              this.requestUpdate();
            }}
          >
            Clear
          </button>
        </div>
        <table class="history-table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Model</th>
              <th>Theme</th>
              <th>Time</th>
              <th>Files</th>
              <th>Chars</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${[...this.telemetry.runs]
              .sort((a, b) => {
                const order: Record<string, number> = {
                  "one-shot": 0,
                  prefab: 1,
                  "design-first": 2,
                };
                return (order[a.mode] ?? 9) - (order[b.mode] ?? 9);
              })
              .map((run) => {
              const hasCode = !!this.telemetry.getCode(run.id);
              let mode = run.mode as string;
              if (
                run.mode === "prefab" &&
                (run.allowCustomComponents ?? true) === false
              ) {
                mode += " · strict";
              }
              if (run.imageModel) {
                mode += ` · ${run.imageModel}`;
              }
              const theme = run.theme ?? "editorial";
              const themeLabel = theme + (run.themeAwareLayout ? " ⚡" : "");
              const modelLabel =
                MODEL_LABELS[run.model as GeminiModel] ?? "3.1 Pro";
              return html`
                <tr @click=${() => this.#replayRun(run)}>
                  <td><span class="history-mode">${mode}</span></td>
                  <td>${modelLabel}</td>
                  <td>${themeLabel}</td>
                  <td class="history-bold">
                    ${(run.totalTimeMs / 1000).toFixed(1)}s
                  </td>
                  <td class="history-muted">${run.outputFileCount}</td>
                  <td class="history-muted">
                    ${(run.outputTotalChars / 1000).toFixed(1)}k
                  </td>
                  <td>
                    ${hasCode
                      ? html`<span class="history-replay"
                          ><span class="g-icon">play_arrow</span></span
                        >`
                      : nothing}
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  #renderSourceViewer() {
    const files = this.sourceFiles!;
    const fileNames = Object.keys(files);
    const activeContent = files[this.sourceActiveFile] ?? "";

    return html`
      <div class="source-viewer">
        <div class="source-header">
          <span class="g-icon" style="font-size: 16px">code</span>
          <span>Generated Source</span>
          <span style="flex: 1"></span>
          <button
            class="source-close"
            title="Copy all sources"
            @click=${this.#copyAllSources}
          >
            <span class="g-icon">content_copy</span>
          </button>
          <button
            class="source-close"
            @click=${() => (this.showSource = false)}
          >
            <span class="g-icon">close</span>
          </button>
        </div>
        <div class="source-tabs">
          ${fileNames.map(
            (name) => html`
              <button
                class="source-tab"
                ?data-active=${name === this.sourceActiveFile}
                @click=${() => (this.sourceActiveFile = name)}
              >
                ${name}
              </button>
            `
          )}
        </div>
        <div class="source-code">${activeContent}</div>
      </div>
    `;
  }

  // ─── Copy all sources as multipart string ─────────────────────

  async #copyAllSources() {
    if (!this.sourceFiles) return;
    const parts = Object.entries(this.sourceFiles).map(
      ([name, content]) => `── ${name} ──\n${content}`
    );
    const text = parts.join("\n\n");
    await navigator.clipboard.writeText(text);
  }

  // ─── Context Viewer ──────────────────────────────────────────

  #md = MarkdownIt();

  #renderContextViewer() {
    const dataset = formatPlaybooksForPrompt();
    return html`
      <div class="context-viewer">
        <div class="source-header">
          <span class="g-icon" style="font-size: 16px">visibility</span>
          <span>Model Context</span>
          <span style="flex: 1"></span>
          <button
            class="source-close"
            @click=${() => (this.showContext = false)}
          >
            <span class="g-icon">close</span>
          </button>
        </div>
        <div class="context-content">
          <div class="context-section">
            <div class="context-section-title">Persona</div>
            ${unsafeHTML(this.#md.render(this.personaText || "Not loaded"))}
          </div>
          <div class="context-section">
            <div class="context-section-title">
              Playbook Data (${dataset.length} chars)
            </div>
            ${unsafeHTML(this.#md.render(dataset))}
          </div>
        </div>
      </div>
    `;
  }

  // ─── Telemetry Export ────────────────────────────────────────

  async #copyTelemetryMarkdown() {
    const md = this.#telemetryToMarkdown();
    await navigator.clipboard.writeText(md);
  }

  #telemetryToMarkdown(): string {
    const runs = this.telemetry.runs;
    if (runs.length === 0) return "No runs recorded.";

    const header =
      "| # | Mode | Model | Theme | Aware | Strict | Time (s) | Gen (s) | Files | Chars | Prompt |";
    const sep =
      "|---|------|-------|-------|-------|--------|----------|---------|-------|-------|--------|";
    const modeOrder: Record<string, number> = {
      "one-shot": 0,
      prefab: 1,
      "design-first": 2,
    };
    const sorted = [...runs].sort(
      (a, b) => (modeOrder[a.mode] ?? 9) - (modeOrder[b.mode] ?? 9)
    );
    const rows = sorted.map((r, i) => {
      const mode = r.mode + (r.imageModel ? ` · ${r.imageModel}` : "");
      const model = MODEL_LABELS[r.model as GeminiModel] ?? "3.1 Pro";
      const theme = r.theme ?? "editorial";
      const aware = r.themeAwareLayout ? "⚡" : "";
      const strict =
        r.mode === "prefab" && (r.allowCustomComponents ?? true) === false
          ? "✓"
          : "";
      const total = (r.totalTimeMs / 1000).toFixed(1);
      const gen = (r.generateTimeMs / 1000).toFixed(1);
      const files = r.outputFileCount;
      const chars = (r.outputTotalChars / 1000).toFixed(1) + "k";
      const prompt = (r.promptSizeChars / 1000).toFixed(1) + "k";
      return `| ${i + 1} | ${mode} | ${model} | ${theme} | ${aware} | ${strict} | ${total} | ${gen} | ${files} | ${chars} | ${prompt} |`;
    });

    return [header, sep, ...rows].join("\n");
  }

  // ─── Replay a past run ────────────────────────────────────────

  #replayRun(run: RunRecord) {
    const code = this.telemetry.getCode(run.id);
    const files = this.telemetry.getFiles(run.id);

    if (!code) return;

    // Load source files into the viewer
    if (files) {
      this.sourceFiles = files;
      this.sourceActiveFile = Object.keys(files)[0] ?? "";
      this.sourceRunId = run.id;
    }

    // Re-render the output in the iframe — cycle iframeReady to
    // force Lit to destroy and recreate the iframe element.
    this.lastRun = run;
    this.#pendingResult = { code, files: files ?? {} };
    this.generating = false;
    this.errorMessage = "";
    this.iframeReady = false;
    this.showHistory = false;

    // Next microtask: re-enable so the fresh iframe triggers @load
    requestAnimationFrame(() => {
      this.iframeReady = true;
    });
  }

  // Held between generate and iframe render so we can send code once ready.
  #pendingResult: GenerateResult | null = null;

  #onIframeLoad() {
    const iframe = this.shadowRoot?.querySelector("iframe");
    if (!iframe || !this.#pendingResult) return;
    this.iframeEl = iframe;

    const onReady = (event: MessageEvent) => {
      if (
        event.source === iframe.contentWindow &&
        event.data?.type === "ready"
      ) {
        window.removeEventListener("message", onReady);
        iframe.contentWindow?.postMessage(
          { type: "render", code: this.#pendingResult!.code, props: {} },
          "*"
        );
        // Apply theme CSS overrides
        const themeCss = getThemeCss(this.theme);
        if (themeCss) {
          iframe.contentWindow?.postMessage(
            { type: "update-theme", css: themeCss },
            "*"
          );
        }
        this.#pendingResult = null;
      }
    };
    window.addEventListener("message", onReady);
  }

  async #handleGenerate() {
    if (this.generating) return;
    this.generating = true;
    this.errorMessage = "";
    this.streamText = "";
    this.stageLabel = "";
    this.iframeReady = false;
    this.sourceFiles = null;

    const dataset = formatPlaybooksForPrompt();

    // Compose the skill: UI infrastructure + editorial art direction
    let skill = this.uiSkillText + "\n\n---\n\n" + this.skillText;

    if (this.mode === "prefab") {
      const strictPreamble = this.allowCustomComponents
        ? ""
        : "\n\n## STRICT PREFAB MODE\n\n" +
          "You MUST ONLY use the prefab components listed below. " +
          "Do NOT create any custom React components or write raw HTML elements. " +
          "Every visual element must be composed from the @prefab/ library. " +
          "If a layout seems impossible with prefabs alone, compose them creatively — " +
          "nest them, style them via the style prop, use CSS positioning via inline styles. " +
          "But you may NOT define any function components or JSX elements outside of App().\n";
      skill += strictPreamble + "\n\n---\n\n" + this.prefabText;
    }

    // Append token discipline + responsive guidance
    // Optionally include theme-specific layout prompt
    skill += this.themeAwareLayout
      ? "\n\n---\n\n" + getThemePrompt(this.theme)
      : "\n\n---\n\n" + UNIVERSAL_GUIDANCE;

    const promptSize = (this.personaText + skill + dataset).length;
    const generateStart = performance.now();

    const objective =
      "Create a magazine-style home page showing this user's 20 active playbooks. " +
      "This is their personal morning briefing — curate by urgency and narrative flow, " +
      "not by category. Make it feel like a thoughtful EA prepared it overnight.";

    const context =
      "Wednesday morning, 6:15am — earlier than usual. The move deadline is three " +
      "days out and the address-change forms are untouched. They procrastinate on " +
      "bureaucratic tasks, so this needs gentle but firm surfacing.\n\n" +
      "Good energy stretch: 12-day workout streak, sleep steady, houseplants thriving " +
      "(proudly repotted the fiddle-leaf fig last weekend). Small wins matter to them.\n\n" +
      "Stress moderate but rising — pediatrician Thursday, dentist next week, own " +
      "physical needs rescheduling. Partner handling school pickup this week, so " +
      "afternoons are free. Budget analyzer found $340/month in savings yesterday, " +
      "which excited them. Two project reviews colleagues are waiting on.\n\n" +
      "Disposition: cautiously optimistic, slightly overwhelmed by accumulating small tasks.";

    try {
      let result: GenerateResult;
      let stageTimes:
        | {
            assessMs: number;
            designMs: number;
            generateMs: number;
            transformMs: number;
          }
        | undefined;

      if (this.mode === "design-first") {
        const dfResult = await generateDesignFirst({
          objective,
          context,
          skill,
          persona: this.personaText,
          dataset,
          designPrompt: "",
          imageModel: this.imageModel,
          model: this.geminiModel,
          onThought: (text) => (this.streamText += text),
          onChunk: (text) => (this.streamText += text),
          onStage: (stage) => {
            this.stageLabel = stage;
            this.streamText = "";
          },
        });
        result = dfResult;
        stageTimes = dfResult.stageTimes;
      } else {
        result = await generate({
          objective,
          context,
          skill,
          persona: this.personaText,
          dataset,
          model: this.geminiModel,
          onThought: (text) => (this.streamText += text),
          onChunk: (text) => (this.streamText += text),
        });
      }

      const generateEnd = performance.now();

      // Store result for iframe to consume on load
      this.#pendingResult = result;
      this.generating = false;
      this.iframeReady = true;

      const totalEnd = performance.now();

      this.lastRun = this.telemetry.addRun(
        {
          mode: this.mode,
          generateTimeMs: Math.round(generateEnd - generateStart),
          transformTimeMs: Math.round(totalEnd - generateEnd),
          totalTimeMs: Math.round(totalEnd - generateStart),
          promptSizeChars: promptSize,
          outputFileCount: Object.keys(result.files).length,
          outputTotalChars: Object.values(result.files).reduce(
            (sum, f) => sum + f.length,
            0
          ),
          stageTimes,
          allowCustomComponents:
            this.mode === "prefab" ? this.allowCustomComponents : undefined,
          imageModel:
            this.mode === "design-first" ? this.imageModel : undefined,
          theme: this.theme,
          model: this.geminiModel,
          themeAwareLayout: this.themeAwareLayout,
        },
        result.code,
        result.files
      );

      // Store files for on-demand source viewing
      this.sourceFiles = result.files;
      this.sourceActiveFile = Object.keys(result.files)[0] ?? "";
      this.sourceRunId = this.lastRun.id;
      this.showSource = false;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.generating = false;
    }
  }
}
