// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Main app shell — identity, iframe, presence, gesture layer, agent prompt.
 *
 * This is the parent frame. It owns:
 *  - Identity (name picker → sessionStorage)
 *  - Yjs connection (via sync.ts)
 *  - CollabBridge (postMessage ↔ Yjs translation)
 *  - Presence sidebar + cursor overlay (outside iframe)
 *  - GestureLayer (ea-ux circle-select → agent prompt)
 *
 * The React App.jsx inside the iframe is unaware of any of this.
 */

import { LitElement, html, css } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { provider } from "./sync.js";
import { getIdentity, setIdentity, type Identity } from "./identity.js";
import { CollabBridge } from "./bridge.js";
import { GestureLayer, type GestureResult } from "./gesture-layer.js";
import { DistortionLayer } from "./distortion-layer.js";

// Side-effect imports: register custom elements.
import "./presence.js";
import "./cursors.js";

/**
 * The initial context shape — equivalent to an XState machine's context.
 *
 * The bridge inspects this to create the matching CRDT structure:
 *   arrays  → Y.Array
 *   objects → Y.Map
 *   scalars → Y.Map fields
 */
const INITIAL_CONTEXT = {
  view: "planning",
  theme: "midnight",
  guests: [],
  tasks: [],
  notes: "",
};

const AGENT_API = "http://localhost:4445/api/agent";

@customElement("party-app")
export class PartyApp extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-columns: 1fr 240px;
      grid-template-rows: auto 1fr;
      gap: 16px;
      height: 100vh;
      padding: 16px;
    }

    header {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .title {
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .title span {
      font-size: 24px;
    }

    .identity-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }

    .connection-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--color-text-muted, #8888a0);
    }

    .connection-status .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .connection-status .dot.connected {
      background: var(--color-success, #34d399);
      box-shadow: 0 0 6px var(--color-success, #34d399);
    }

    .connection-status .dot.disconnected {
      background: var(--color-danger, #f87171);
    }

    .viewport {
      position: relative;
      border-radius: var(--radius, 10px);
      overflow: hidden;
      border: 1px solid var(--color-border, #2e2e3e);
    }

    .viewport iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    aside {
      overflow-y: auto;
    }

    .card {
      background: var(--color-surface, #1a1a24);
      border: 1px solid var(--color-border, #2e2e3e);
      border-radius: var(--radius, 10px);
      padding: 16px;
    }

    /* ── Gesture canvas ──────────────────────────────────── */

    #gesture-canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 50;
      pointer-events: none;
    }

    #gesture-canvas.active {
      pointer-events: auto;
      cursor: crosshair;
    }

    /* ── Activate button (FAB) ───────────────────────────── */

    /* ── Activate button — REMOVED, activation via presence entry ── */

    /* ── Prompt overlay ──────────────────────────────────── */

    .prompt-overlay {
      position: fixed;
      z-index: 55;
      display: none;
    }

    .prompt-overlay.visible {
      display: block;
    }

    .prompt-card {
      background: var(--color-surface, #1a1a24);
      border: 1px solid var(--color-border, #2e2e3e);
      border-radius: var(--radius, 10px);
      padding: 16px;
      min-width: 360px;
      box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6);
      animation: prompt-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes prompt-in {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(8px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .prompt-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-accent, #7c6cff);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .prompt-hint {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-bottom: 10px;
    }

    .prompt-input {
      width: 100%;
      padding: 10px 14px;
      background: var(--color-surface-alt, #22222e);
      border: 1px solid var(--color-border, #2e2e3e);
      border-radius: 6px;
      color: var(--color-text, #e8e8f0);
      font-family: var(--font, system-ui);
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }

    .prompt-input:focus {
      border-color: var(--color-accent, #7c6cff);
      box-shadow: 0 0 0 2px var(--color-accent-glow, rgba(124, 108, 255, 0.2));
    }

    /* ── Blur overlay (behind prompt) ────────────────────── */

    .blur-overlay {
      position: fixed;
      inset: 0;
      z-index: 45;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }

    .blur-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* ── Identity overlay ─────────────────────────────────── */

    .identity-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 1000;
    }

    .identity-card {
      background: var(--color-surface, #1a1a24);
      border: 1px solid var(--color-border, #2e2e3e);
      border-radius: var(--radius, 10px);
      padding: 32px;
      text-align: center;
      min-width: 320px;
    }

    .identity-card h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .identity-card p {
      color: var(--color-text-muted, #8888a0);
      margin-bottom: 20px;
    }

    .identity-card input {
      width: 100%;
      padding: 10px 14px;
      background: var(--color-surface-alt, #22222e);
      border: 1px solid var(--color-border, #2e2e3e);
      border-radius: 6px;
      color: var(--color-text, #e8e8f0);
      font-family: var(--font, system-ui);
      font-size: 16px;
      text-align: center;
      outline: none;
      margin-bottom: 16px;
      box-sizing: border-box;
    }

    .identity-card input:focus {
      border-color: var(--color-accent, #7c6cff);
      box-shadow: 0 0 0 2px var(--color-accent-glow, rgba(124, 108, 255, 0.2));
    }

    .identity-card button {
      width: 100%;
      padding: 10px;
      font-size: 15px;
    }
  `;

  @state() private identity: Identity | null = null;
  @state() private connected = false;
  @state() private selecting = false;
  @state() private promptVisible = false;
  @state() private promptPosition = { x: 0, y: 0 };
  @state() private focusHint: string | null = null;
  @state() private focusLabel: string | null = null;
  @query("iframe") private iframe!: HTMLIFrameElement;
  @query(".prompt-input") private promptInput!: HTMLInputElement;

  private bridge: CollabBridge | null = null;
  private gesture: GestureLayer | null = null;
  private distortion: DistortionLayer | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.identity = getIdentity();
    provider.on("status", this.#handleConnectionStatus);
    this.#handleConnectionStatus({
      status: provider.wsconnected ? "connected" : "disconnected",
    });

    // Global keyboard shortcuts.
    document.addEventListener("keydown", this.#handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    provider.off("status", this.#handleConnectionStatus);
    document.removeEventListener("keydown", this.#handleKeydown);
    this.bridge?.destroy();
    this.gesture?.destroy();
  }

  protected firstUpdated() {
    // Initialize gesture layer on the canvas.
    const canvas = this.renderRoot.querySelector(
      "#gesture-canvas"
    ) as HTMLCanvasElement;
    if (canvas) {
      this.gesture = new GestureLayer(canvas, this.#handleGestureComplete);
    }

    // Initialize WebGL distortion layer.
    this.distortion = new DistortionLayer(document.body);
  }

  protected updated() {
    // Initialize bridge once iframe is rendered.
    if (this.iframe && !this.bridge) {
      this.bridge = new CollabBridge(this.iframe, INITIAL_CONTEXT);

      // Listen for section rect reports from the iframe.
      window.addEventListener("message", this.#handleIframeMessage);
    }
  }

  #handleConnectionStatus = (event: { status: string }) => {
    this.connected = event.status === "connected";
  };

  // ── Gesture Flow ────────────────────────────────────────

  #toggleSelecting = () => {
    if (this.promptVisible) {
      // Dismiss prompt.
      this.#dismissPrompt();
      return;
    }

    this.selecting = !this.selecting;
    if (this.selecting) {
      this.gesture?.activate();
    } else {
      this.gesture?.deactivate();
      this.gesture?.clearTrail();
    }
  };

  #handleGestureComplete = async (result: GestureResult) => {
    this.selecting = false;
    this.gesture?.deactivate();

    // Focus hint — section the user had in focus (may be null).
    this.focusHint = result.circled[0] ?? null;
    this.focusLabel = result.labels[0] ?? null;

    // Request a DOM snapshot from the iframe for the distortion texture.
    const dataUrl = await this.#requestCapture();

    if (dataUrl && this.distortion) {
      // Map gesture center to iframe-relative coordinates for the shader.
      const iframeRect = this.iframe.getBoundingClientRect();
      this.distortion.activate(
        dataUrl,
        result.center.x - iframeRect.left,
        result.center.y - iframeRect.top,
        iframeRect
      );

      // Let the ripple play, then fade it and show the prompt.
      await new Promise<void>((r) => setTimeout(r, 500));
      this.distortion.fadeOut();
    }

    // Position prompt near the gesture center.
    const x = Math.min(result.center.x, window.innerWidth - 400);
    const y = Math.min(result.center.y + 20, window.innerHeight - 120);
    this.promptPosition = { x, y };

    this.promptVisible = true;
    this.updateComplete.then(() => {
      this.promptInput?.focus();
    });
  };

  /** Ask the iframe to capture its DOM via html2canvas and return the image. */
  #pendingCapture: ((url: string) => void) | null = null;

  #requestCapture(): Promise<string | null> {
    return new Promise((resolve) => {
      this.#pendingCapture = resolve;
      this.iframe.contentWindow?.postMessage({ type: "capture" }, "*");
      // Timeout in case iframe doesn't respond.
      setTimeout(() => {
        if (this.#pendingCapture) {
          this.#pendingCapture = null;
          resolve(null);
        }
      }, 2000);
    });
  }

  #dismissPrompt() {
    this.promptVisible = false;
    this.focusHint = null;
    this.focusLabel = null;
    this.gesture?.clearTrail();
  }

  #handlePromptKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.#dismissPrompt();
      return;
    }

    if (e.key === "Enter") {
      e.stopPropagation();
      const input = e.target as HTMLInputElement;
      const prompt = input.value.trim();
      if (prompt) {
        this.#callAgent(prompt, this.focusHint);
        this.#dismissPrompt();
      }
    }
  };

  async #callAgent(prompt: string, focusHint: string | null) {
    try {
      await fetch(AGENT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          target: focusHint,
          room: "party-default",
        }),
      });
    } catch (err) {
      console.error("Agent call failed:", err);
    }
  }

  #handleIframeMessage = (e: MessageEvent) => {
    if (e.source !== this.iframe?.contentWindow) return;
    const { data } = e;
    if (!data?.type) return;

    // Section rect reports for gesture hit detection.
    if (data.type === "tracker" && data.event === "sections") {
      const iframeRect = this.iframe.getBoundingClientRect();
      this.gesture?.updateSections(data.rects, {
        x: iframeRect.left,
        y: iframeRect.top,
      });
    }

    // Capture result for distortion texture.
    if (data.type === "capture-result" && this.#pendingCapture) {
      this.#pendingCapture(data.dataUrl);
      this.#pendingCapture = null;
    }

    // Shortcut forwarding from iframe.
    if (data.type === "shortcut" && data.key === "toggle-select") {
      this.#toggleSelecting();
    }
    if (data.type === "shortcut" && data.key === "escape") {
      if (this.promptVisible) {
        this.#dismissPrompt();
      } else if (this.selecting) {
        this.#toggleSelecting();
      }
    }
  };

  #handleKeydown = (e: KeyboardEvent) => {
    // Escape: dismiss prompt or deselect.
    if (e.key === "Escape") {
      if (this.promptVisible) {
        this.#dismissPrompt();
      } else if (this.selecting) {
        this.#toggleSelecting();
      }
      return;
    }

    // Cmd+E / Ctrl+E: toggle selection mode.
    if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.#toggleSelecting();
    }
  };

  // ── Identity ────────────────────────────────────────────

  #handleIdentitySubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector("input") as HTMLInputElement;
    const name = input?.value?.trim();
    if (name) {
      this.identity = setIdentity(name);
    }
  }

  #handleIdentityKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      const input = e.target as HTMLInputElement;
      const name = input?.value?.trim();
      if (name) {
        this.identity = setIdentity(name);
      }
    }
  }

  // ── Render ──────────────────────────────────────────────

  render() {
    if (!this.identity) {
      return html`
        <div class="identity-overlay">
          <div class="identity-card">
            <h1>🎉 Party Planner</h1>
            <p>Who are you?</p>
            <form @submit=${this.#handleIdentitySubmit}>
              <input
                type="text"
                placeholder="Your name"
                autofocus
                @keydown=${this.#handleIdentityKeydown}
              />
              <button type="submit">Join</button>
            </form>
          </div>
        </div>
      `;
    }

    return html`
      <header>
        <div class="title"><span>🎉</span> Party Planner</div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div class="connection-status">
            <div
              class="dot ${this.connected ? "connected" : "disconnected"}"
            ></div>
            ${this.connected ? "Connected" : "Disconnected"}
          </div>
          <div
            class="identity-badge"
            style="background: ${this.identity.color}22; color: ${this.identity
              .color}; border: 1px solid ${this.identity.color}44;"
          >
            ${this.identity.name}
          </div>
        </div>
      </header>

      <div class="viewport">
        <iframe src="/app.html"></iframe>
      </div>

      <aside class="card">
        <party-presence
          @gemini-activate=${this.#toggleSelecting}
        ></party-presence>
      </aside>

      <party-cursors></party-cursors>

      <!-- Gesture canvas overlay -->
      <canvas
        id="gesture-canvas"
        class=${this.selecting ? "active" : ""}
      ></canvas>

      <!-- Blur overlay behind prompt -->
      <div
        class="blur-overlay ${this.promptVisible ? "visible" : ""}"
        @click=${() => this.#dismissPrompt()}
      ></div>

      <!-- Prompt overlay -->
      <div
        class="prompt-overlay ${this.promptVisible ? "visible" : ""}"
        style="left: ${this.promptPosition.x}px; top: ${this.promptPosition
          .y}px;"
      >
        <div class="prompt-card">
          <div class="prompt-label">
            ${this.focusLabel ? `✨ ${this.focusLabel}` : "✨ Ask Gemini"}
          </div>
          ${this.focusLabel
            ? html`<div class="prompt-hint">Focus: ${this.focusLabel}</div>`
            : html`<div class="prompt-hint">
                No specific focus — Gemini will figure it out
              </div>`}
          <input
            class="prompt-input"
            type="text"
            placeholder=${this.focusLabel
              ? `What should Gemini do with ${this.focusLabel.toLowerCase()}?`
              : "What should Gemini do?"}
            @keydown=${this.#handlePromptKeydown}
          />
        </div>
      </div>
    `;
  }
}
