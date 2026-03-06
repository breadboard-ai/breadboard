/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<cg-preview>` — Right-side preview area.
 *
 * Renders the selected component in an iframe with:
 * - **Preview header** — component name, tag, theme switcher, code/debug toggles
 * - **Concept panel** — shows the AI-generated concept image (from Imagine)
 * - **Resize handle** — draggable divider between concept and preview
 * - **Code panel** — source code viewer (toggled via { } button)
 * - **Iframe container** — the live React component preview
 * - **Inspector** — TweakPane wrapper (toggled via ⚙ button)
 *
 * ## Selection flow
 *
 * Listens for `component-selected` events (from `<cg-library>`), looks up
 * the component in the registry, renders it in an iframe via
 * `renderComponentInIframe`, and updates TweakPane.
 *
 * ## Theme switching
 *
 * The theme dropdown sends `update-theme` postMessages to the iframe.
 * The active theme is persisted in localStorage.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { Pane } from "tweakpane";
import { registry, type GeneratedComponent } from "../core/registry.js";
import { renderComponentInIframe } from "../preview/iframe.js";
import { THEMES } from "../preview/themes.js";
import { appState } from "../state.js";

@customElement("cg-preview")
export class CgPreview extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    /* ── Header ── */
    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-bottom: 1px solid var(--host-border);
      flex: none;
    }

    .preview-header-info {
      display: flex;
      align-items: baseline;
      gap: 12px;
      min-width: 0;
    }

    .preview-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--host-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preview-tag {
      font-size: 12px;
      color: var(--host-text-muted);
      font-family: var(--host-font-mono);
    }

    .preview-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    /* ── Theme ── */
    .theme-select {
      padding: 6px 10px;
      background: var(--host-surface-2);
      border: 1px solid var(--host-border);
      border-radius: var(--host-radius-sm);
      color: var(--host-text);
      font-size: 12px;
      cursor: pointer;
      outline: none;
      font-family: var(--host-font);
    }

    /* ── Toggle buttons ── */
    .toggle-btn {
      padding: 6px 10px;
      background: var(--host-surface-2);
      border: 1px solid var(--host-border);
      border-radius: var(--host-radius-sm);
      color: var(--host-text-muted);
      font-size: 13px;
      cursor: pointer;
      font-family: var(--host-font-mono);
      transition: all 0.15s;
    }
    .toggle-btn:hover {
      background: var(--host-surface-3);
    }
    .toggle-btn.active {
      background: var(--host-accent);
      color: #111;
      border-color: var(--host-accent);
    }

    /* ── Body ── */
    .preview-body {
      flex: 1;
      display: flex;
      position: relative;
      min-height: 0;
    }

    /* ── Concept panel ── */
    .concept-panel {
      width: 300px;
      flex: none;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--host-surface-1);
      border-right: 1px solid var(--host-border);
    }
    .concept-panel img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    /* ── Resize handle ── */
    .resize-handle {
      width: 6px;
      cursor: col-resize;
      background: var(--host-border);
      flex: none;
      transition: background 0.15s;
    }
    .resize-handle:hover,
    .resize-handle.dragging {
      background: var(--host-accent-dim);
    }

    /* ── Preview container ── */
    .preview-container {
      flex: 1;
      min-width: 0;
      position: relative;
    }
    .preview-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    .preview-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 12px;
      color: var(--host-text-muted);
    }
    .preview-empty-icon {
      font-size: 32px;
      opacity: 0.3;
    }

    /* ── Code panel ── */
    .code-panel {
      position: absolute;
      inset: 0;
      background: var(--host-surface-1);
      overflow: auto;
      z-index: 2;
    }
    .code-content {
      padding: 20px;
      font-size: 13px;
      font-family: var(--host-font-mono);
      line-height: 1.6;
      color: var(--host-text);
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Inspector (TweakPane) ── */
    .tweakpane-container {
      position: absolute;
      top: 0;
      right: 0;
      z-index: 3;
      width: 300px;
      max-height: 100%;
      overflow-y: auto;
    }
  `;

  /** The currently active theme ID, persisted to localStorage. */
  @state()
  accessor activeThemeId = localStorage.getItem("cg:theme") ?? THEMES[0].id;

  /** The currently selected/displayed component. */
  @state()
  accessor activeComponent: GeneratedComponent | null = null;

  /** TweakPane instance — imperatively managed. */
  private pane: Pane | null = null;

  @query(".preview-container")
  accessor previewContainer!: HTMLDivElement;

  @query(".tweakpane-container")
  accessor tweakpaneContainer!: HTMLDivElement;

  @query(".concept-panel")
  accessor conceptPanel!: HTMLDivElement;

  /** Track the previously rendered tag to detect selection changes. */
  private renderedTag: string | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener(
      "theme-change",
      this.#handleThemeChange as EventListener
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.pane?.dispose();
    this.removeEventListener(
      "theme-change",
      this.#handleThemeChange as EventListener
    );
  }

  override render() {
    // Read selectedTag — SignalWatcher ensures we re-render when it changes.
    const tag = appState.selectedTag;
    const component = tag ? (registry.get(tag) ?? null) : null;
    this.activeComponent = component;

    const isCodeVisible = appState.codeVisible;
    const isInspectorVisible = appState.inspectorVisible;
    const concept = appState.conceptImage;
    const hasConcept = concept && !component;

    return html`
      <div class="preview-body">
        ${hasConcept
          ? html`
              <div class="concept-panel">
                <img src="data:${concept.mimeType};base64,${concept.base64}" />
              </div>
              <div
                class="resize-handle"
                @pointerdown=${this.#onResizeStart}
              ></div>
            `
          : nothing}

        <div class="preview-container">
          ${!component
            ? html`
                <div class="preview-empty">
                  <span class="preview-empty-icon">✦</span>
                  <p>Generate a component to see it here</p>
                </div>
              `
            : nothing}
        </div>

        ${isCodeVisible && component
          ? html`
              <div class="code-panel">
                <pre class="code-content">${component.code}</pre>
              </div>
            `
          : nothing}
        ${isInspectorVisible
          ? html`<div class="tweakpane-container"></div>`
          : nothing}
      </div>
    `;
  }

  /**
   * After each render, check if the selected tag changed and render
   * the component in the iframe. Also rebuild TweakPane if needed.
   */
  override async updated() {
    const tag = appState.selectedTag;

    // New selection — render component in iframe.
    if (tag && tag !== this.renderedTag) {
      this.renderedTag = tag;
      const component = registry.get(tag);
      if (!component) return;

      appState.codeVisible = false;

      const container = this.previewContainer;
      if (!container) return;

      // Clear existing content.
      const existing = container.querySelector("iframe");
      if (existing) existing.remove();
      const empty = container.querySelector(".preview-empty");
      if (empty) empty.remove();

      await renderComponentInIframe(container, component);
      this.#applyTheme();
    }

    // Deselected.
    if (!tag && this.renderedTag) {
      this.renderedTag = null;
    }

    // Rebuild TweakPane if visible.
    if (appState.inspectorVisible && this.activeComponent) {
      this.#rebuildTweakPane();
    }
  }

  /** Send the active theme’s CSS to the preview iframe. */
  #applyTheme() {
    const theme = THEMES.find((t) => t.id === this.activeThemeId);
    if (!theme?.css) return;
    const iframe = this.previewContainer?.querySelector("iframe");
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "update-theme", css: theme.css },
        "*"
      );
    }
  }

  #handleThemeChange(e: CustomEvent<string>) {
    const id = e.detail;
    this.activeThemeId = id;
    localStorage.setItem("cg:theme", id);
    this.#applyTheme();
  }

  // ─── TweakPane ──────────────────────────────────────────────────

  /**
   * Rebuild the TweakPane inspector for the currently selected component.
   *
   * TweakPane is inherently imperative — it creates DOM nodes and manages
   * its own state. We tear it down and rebuild on each selection change.
   */
  #rebuildTweakPane() {
    this.pane?.dispose();

    const container = this.tweakpaneContainer;
    if (!container) return;

    const component = this.activeComponent;
    if (!component) return;

    // Snapshot styles before Pane creation — TweakPane injects `<style>`
    // into document.head, but those can't reach inside our shadow DOM.
    const stylesBefore = new Set(document.head.querySelectorAll("style"));

    this.pane = new Pane({ container, title: "Inspector" });

    // Clone any newly injected styles into our shadow root.
    for (const el of document.head.querySelectorAll("style")) {
      if (!stylesBefore.has(el)) {
        this.renderRoot.appendChild(el.cloneNode(true));
      }
    }

    // ── Props folder ──
    this.#buildPropsFolder(component);
  }

  #buildPropsFolder(component: GeneratedComponent) {
    if (!this.pane) return;

    const props = component.props;
    if (props.length === 0) {
      const folder = this.pane.addFolder({ title: "Props", expanded: true });
      const placeholder = { info: "No @prop annotations" };
      folder.addBinding(placeholder, "info", { label: "", readonly: true });
      return;
    }

    const folder = this.pane.addFolder({ title: "Props", expanded: true });
    const params: Record<string, unknown> = {};
    for (const prop of props) {
      params[prop.name] = this.#coerceDefault(prop);
    }

    for (const prop of props) {
      const binding = folder.addBinding(params, prop.name, {
        label: prop.name,
      });
      binding.on("change", () => {
        this.#sendPropsToIframe(params);
      });
    }
  }

  #coerceDefault(prop: { type: string; defaultValue: string | null }): unknown {
    const val = prop.defaultValue;
    if (val === null || val === undefined) {
      switch (prop.type) {
        case "number":
          return 0;
        case "boolean":
          return false;
        default:
          return "";
      }
    }

    // Strip quotes from string defaults.
    const unquoted = val.replace(/^["']|["']$/g, "");

    switch (prop.type) {
      case "number":
        return Number(unquoted) || 0;
      case "boolean":
        return unquoted === "true";
      default:
        return unquoted;
    }
  }

  #sendPropsToIframe(params: Record<string, unknown>) {
    const iframe = this.previewContainer?.querySelector("iframe");
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "update-props", props: params },
        "*"
      );
    }
  }

  // ─── Resize ─────────────────────────────────────────────────────

  /**
   * Pointer-based drag handler for resizing the concept panel.
   * Uses pointer capture for smooth, uninterrupted dragging.
   */
  #onResizeStart(e: PointerEvent) {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");

    const conceptPanel = this.conceptPanel;
    const startX = e.clientX;
    const startWidth = conceptPanel.getBoundingClientRect().width;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = Math.max(200, startWidth + dx);
      conceptPanel.style.width = `${newWidth}px`;
    };

    const onUp = () => {
      handle.classList.remove("dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cg-preview": CgPreview;
  }
}
