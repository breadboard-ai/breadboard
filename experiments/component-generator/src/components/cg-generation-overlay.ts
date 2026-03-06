/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<cg-generation-overlay>` — Full-screen modal for component generation.
 *
 * Opened via the `+ New` button in the top bar. Contains:
 * - Reference image drop zone (large)
 * - AI-generated concept image (large preview)
 * - Prompt text input
 * - Generate + Imagine buttons
 * - Thinking panel with markdown rendering
 *
 * Auto-closes when generation completes (component registered).
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import MarkdownIt from "markdown-it";
import { generate, imagine, processUploadedFile } from "../actions.js";
import { appState } from "../state.js";

const md = new MarkdownIt();

@customElement("cg-generation-overlay")
export class CgGenerationOverlay extends SignalWatcher(LitElement) {
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
      width: 520px;
      max-height: 85vh;
      background: var(--host-surface-1);
      border: 1px solid var(--host-border);
      border-radius: var(--host-radius-lg);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
    }

    /* ── Header ── */
    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 0;
    }

    .overlay-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--host-text);
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--host-text-muted);
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .close-btn:hover {
      color: var(--host-text);
    }

    /* ── Body ── */
    .overlay-body {
      padding: 20px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ── Image drop zone ── */
    .image-drop {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border: 2px dashed var(--host-border);
      border-radius: var(--host-radius-sm);
      cursor: pointer;
      transition: border-color 0.15s;
      min-height: 60px;
    }
    .image-drop:hover {
      border-color: var(--host-accent-dim);
    }
    .image-drop.has-image {
      border-style: solid;
      border-color: var(--host-accent-dim);
    }
    .image-drop-preview {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .image-drop-label {
      font-size: 13px;
      color: var(--host-text-muted);
    }

    /* ── Concept image (large) ── */
    .concept-image {
      width: 100%;
      max-height: 280px;
      object-fit: contain;
      border-radius: var(--host-radius-sm);
      border: 1px solid var(--host-border);
    }

    /* ── Input ── */
    input[type="text"] {
      width: 100%;
      padding: 12px 16px;
      background: var(--host-surface-2);
      border: 1px solid var(--host-border);
      border-radius: var(--host-radius-sm);
      color: var(--host-text);
      font-size: 14px;
      outline: none;
      font-family: var(--host-font);
    }
    input[type="text"]:focus {
      border-color: var(--host-accent-dim);
    }
    input[type="text"]::placeholder {
      color: var(--host-text-muted);
    }

    /* ── Buttons ── */
    .btn-row {
      display: flex;
      gap: 8px;
    }
    .generate-btn,
    .imagine-btn {
      flex: 1;
      padding: 12px 16px;
      border: none;
      border-radius: var(--host-radius-sm);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--host-font);
      transition: opacity 0.15s;
    }
    .generate-btn {
      background: var(--host-accent);
      color: #111;
    }
    .imagine-btn {
      background: var(--host-surface-3);
      color: var(--host-text);
      border: 1px solid var(--host-border);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-spinner {
      display: none;
      width: 14px;
      height: 14px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    .btn-spinner.active {
      display: inline-block;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* ── Thinking ── */
    .thinking-panel {
      background: var(--host-surface-2);
      border-radius: var(--host-radius-sm);
      overflow: hidden;
    }
    .thinking-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      list-style: none;
      padding: 10px 16px;
    }
    .thinking-summary::-webkit-details-marker {
      display: none;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--host-accent);
      flex-shrink: 0;
      animation: statusPulse 1.5s ease-in-out infinite;
    }
    @keyframes statusPulse {
      0%,
      100% {
        opacity: 0.4;
      }
      50% {
        opacity: 1;
      }
    }
    .status-text {
      font-size: 13px;
      color: var(--host-text-muted);
    }
    .thinking-content {
      padding: 0 16px 12px;
      font-size: 13px;
      line-height: 1.6;
      color: var(--host-text-muted);
      max-height: 300px;
      overflow-y: auto;
    }
    .thinking-content :first-child {
      margin-top: 0;
    }
    .thinking-content :last-child {
      margin-bottom: 0;
    }
    .thinking-content p {
      margin: 0.4em 0;
    }
    .thinking-content code {
      font-family: var(--host-font-mono);
      font-size: 0.9em;
      background: var(--host-surface-3);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .thinking-content pre {
      background: var(--host-surface-3);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .thinking-content pre code {
      background: none;
      padding: 0;
    }
    .thinking-content ul,
    .thinking-content ol {
      padding-left: 1.2em;
    }
    .thinking-content strong {
      color: var(--host-text);
    }
  `;

  private inputRef: HTMLInputElement | null = null;
  /** Track previous loading state to detect generation completion. */
  private wasLoading = false;

  override firstUpdated() {
    this.inputRef = this.renderRoot.querySelector("#overlay-input");
  }

  override updated() {
    // Auto-close when generation completes.
    const isLoading = appState.loading;
    if (this.wasLoading && !isLoading) {
      appState.generationOverlayOpen = false;
    }
    this.wasLoading = isLoading;

    // Re-grab input ref after renders.
    if (!this.inputRef) {
      this.inputRef = this.renderRoot.querySelector("#overlay-input");
    }
  }

  override render() {
    const isLoading = appState.loading;
    const isImagining = appState.imagineLoading;
    const thinkingState = appState.thinking;
    const uploaded = appState.uploadedImage;
    const concept = appState.conceptImage;
    const hasImage = !!(uploaded || concept);

    return html`
      <div class="overlay-card">
        <div class="overlay-header">
          <h2 class="overlay-title">New Component</h2>
          <button
            class="close-btn"
            @click=${this.#close}
            ?disabled=${isLoading}
          >
            ✕
          </button>
        </div>

        <div class="overlay-body">
          <!-- Image drop zone -->
          <label
            class="image-drop ${hasImage ? "has-image" : ""}"
            for="overlay-image-input"
          >
            <input
              id="overlay-image-input"
              type="file"
              accept="image/*"
              hidden
              @change=${this.#onImageChange}
            />
            ${hasImage
              ? html`<img
                  class="image-drop-preview"
                  src=${this.#imagePreviewSrc(uploaded, concept)}
                />`
              : nothing}
            <span class="image-drop-label">
              ${uploaded
                ? "Reference image attached"
                : concept
                  ? "AI-generated concept"
                  : "📎 Drop or click to attach a reference image"}
            </span>
          </label>

          <!-- Concept image (large) -->
          ${concept
            ? html`<img
                class="concept-image"
                src="data:${concept.mimeType};base64,${concept.base64}"
              />`
            : nothing}

          <!-- Input -->
          <input
            id="overlay-input"
            type="text"
            placeholder="Describe a component… e.g. recipe card, weather widget"
            autocomplete="off"
            @keydown=${this.#onKeyDown}
          />

          <!-- Buttons -->
          <div class="btn-row">
            <button
              class="generate-btn"
              ?disabled=${isLoading || isImagining}
              @click=${this.#onGenerate}
            >
              <span>${isLoading ? "Generating…" : "Generate"}</span>
              <span class="btn-spinner ${isLoading ? "active" : ""}"></span>
            </button>
            <button
              class="imagine-btn"
              ?disabled=${isLoading || isImagining}
              @click=${this.#onImagine}
            >
              <span>${isImagining ? "Imagining…" : "✨ Imagine"}</span>
              <span class="btn-spinner ${isImagining ? "active" : ""}"></span>
            </button>
          </div>

          <!-- Thinking panel -->
          ${thinkingState
            ? html`
                <details class="thinking-panel" open>
                  <summary class="thinking-summary">
                    <span class="status-dot"></span>
                    <span class="status-text">${thinkingState.status}</span>
                  </summary>
                  <div
                    class="thinking-content"
                    .innerHTML=${md.render(thinkingState.thoughts)}
                  ></div>
                </details>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  #imagePreviewSrc(
    uploaded: { base64: string; mimeType: string } | null,
    concept: { base64: string; mimeType: string } | null
  ): string {
    const img = concept ?? uploaded;
    return img ? `data:${img.mimeType};base64,${img.base64}` : "";
  }

  #close() {
    appState.generationOverlayOpen = false;
  }

  #onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.#onGenerate();
    }
  }

  async #onGenerate() {
    const description = this.inputRef?.value.trim() ?? "";
    const hasImages = !!(appState.uploadedImage || appState.conceptImage);
    if (!description && !hasImages) return;

    await generate(description || "component from reference image");
    if (this.inputRef) this.inputRef.value = "";
  }

  async #onImagine() {
    const description = this.inputRef?.value.trim() ?? "";
    if (!description) return;
    await imagine(description);
    if (this.inputRef) this.inputRef.value = "";
  }

  async #onImageChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cg-generation-overlay": CgGenerationOverlay;
  }
}
