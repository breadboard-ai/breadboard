/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Full-pane surface view — the "Surface" tab body.
 *
 * Composes agent-declared surface items and the built-in chat panel
 * using a CSS grid layout:
 *
 *   - Chat takes the left half when present
 *   - Content blocks stack vertically in the right half (or full width
 *     without chat)
 *   - Primary bundles are distinguished by a blue left border accent
 *
 * Items with `render: "bundle"` render as sandboxed iframes via
 * `<bees-bundle-frame>`. Other items render as static cards via
 * `<bees-surface-view>`.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketStore } from "../data/ticket-store.js";
import type { MutationClient } from "../data/mutation-client.js";
import type { SurfaceManifest, SurfaceItem, SurfaceSection } from "../data/types.js";
import type { SdkHandlers } from "../../../common/bundle-types.js";
import { hasChatContent } from "./chat-panel.js";
import { getIframeBlobUrl } from "./react-cache.js";
import { sharedStyles } from "./shared-styles.js";
import "./surface-view.js";
import "./bundle-frame.js";
import "./chat-panel.js";
import type { BeesBundleFrame } from "./bundle-frame.js";

export { BeesSurfacePane };

/** Resolved bundle content ready for rendering. */
interface ResolvedBundle {
  item: SurfaceItem;
  code: string;
  css: string | null;
}

@customElement("bees-surface-pane")
class BeesSurfacePane extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
      }

      /* ── Bento grid ── */

      .surface-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        padding: 24px 32px;
        flex: 1;
        min-height: 0;
      }

      .surface-grid.with-chat {
        grid-template-columns: 1fr 1fr;
      }

      /* Chat cell: left column. */
      .chat-cell {
        grid-column: 1;
        min-height: 300px;
        max-height: calc(100vh - 200px);
        background: #0f1115;
        border: 1px solid #1e293b;
        border-radius: 8px;
        overflow: hidden;
      }

      /* When chat is the only content, go full width. */
      .surface-grid.chat-only .chat-cell {
        grid-column: 1 / -1;
        max-height: none;
      }

      /* Content column wraps bundles + surface-view. */
      .content-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }

      .surface-grid.with-chat .content-column {
        grid-column: 2;
      }

      .surface-grid:not(.with-chat) .content-column {
        grid-column: 1 / -1;
      }

      /* ── Bundles within content column ── */

      .bundle-section {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }

      .section-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid #1e293b;
        flex-shrink: 0;
        padding: 0 4px;
      }

      .section-tab {
        padding: 6px 14px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s;
        user-select: none;
      }

      .section-tab.active {
        color: #f8fafc;
        border-bottom-color: #3b82f6;
      }

      .section-tab:hover:not(.active) {
        color: #cbd5e1;
      }

      .bundle-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-top: 8px;
      }

      .bundle-cell {
        min-width: 0;
        flex: 1;
        min-height: 300px;
      }

      .bundle-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: #a5b4fc;
        margin-bottom: 4px;
      }

      .empty-state {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        font-size: 0.9rem;
      }
    `,
  ];

  @property({ attribute: false })
  accessor ticketStore: TicketStore | null = null;

  @property({ attribute: false })
  accessor mutationClient: MutationClient | null = null;

  @property({ type: String })
  accessor ticketId: string | null = null;

  @state() accessor surface: SurfaceManifest | null = null;
  @state() accessor resolvedBundles: ResolvedBundle[] = [];
  @state() accessor iframeBlobUrl: string | null = null;
  @state() accessor activeSection: string | null = null;

  /** Track which ticket ID we last loaded for. */
  #loadedFor: string | null = null;

  /** Deduplicate filesystem change processing. */
  #lastFsChangeAt = 0;

  render() {
    if (!this.ticketStore || !this.ticketId) {
      return html`<div class="empty-state">No surface available</div>`;
    }

    // Reload surface when ticket changes.
    if (this.#loadedFor !== this.ticketId) {
      this.surface = null;
      this.resolvedBundles = [];
      this.activeSection = null;
      this.#loadedFor = this.ticketId;
      this.#lastFsChangeAt = 0;
      this.loadSurface();
    }

    // React to filesystem changes for the current ticket.
    const fsChange = this.ticketStore?.filesystemChange.get();
    if (
      fsChange &&
      fsChange.ticketId === this.ticketId &&
      fsChange.at > this.#lastFsChangeAt
    ) {
      this.#lastFsChangeAt = fsChange.at;
      if (fsChange.paths.includes("surface.json")) {
        this.loadSurface();
      }
      // Forward file changes to bundle iframes after the DOM updates.
      this.updateComplete.then(() => {
        for (const path of fsChange.paths) {
          this.#emitToFrames("filechange", { path });
        }
      });
    }

    // Determine what we have.
    const ticket = this.ticketStore.selectedTicket.get();
    const showChat = !!ticket && hasChatContent(ticket);
    const hasSurfaceItems = !!this.surface && this.surface.items.length > 0;

    if (!showChat && !hasSurfaceItems) return nothing;

    // Split items into bundles and non-bundles.
    const nonBundleItems = this.surface
      ? this.surface.items.filter((i) => i.render !== "bundle")
      : [];
    const nonBundleSurface: SurfaceManifest | null =
      nonBundleItems.length > 0 && this.surface
        ? { ...this.surface, items: nonBundleItems }
        : null;
    const hasBundles = this.resolvedBundles.length > 0;
    const hasContentItems = hasBundles || nonBundleSurface;

    const gridClass = showChat
      ? hasContentItems
        ? "with-chat"
        : "chat-only"
      : "";

    return html`
      <div class="surface-grid ${gridClass}">
        ${showChat
          ? html`<bees-chat-panel
              class="chat-cell"
              .ticketStore=${this.ticketStore}
              .mutationClient=${this.mutationClient}
            ></bees-chat-panel>`
          : nothing}
        ${hasContentItems
          ? html`
              <div class="content-column">
                ${hasBundles ? this.renderBundles() : nothing}
                ${nonBundleSurface
                  ? html`<bees-surface-view
                      .surface=${nonBundleSurface}
                      .contentLoader=${this.#contentLoader}
                    ></bees-surface-view>`
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderBundles() {
    const handlers = this.#makeSdkHandlers();
    const sections = this.surface?.sections ?? [];

    // Group bundles by section id (undefined = default section).
    const grouped = new Map<string | undefined, ResolvedBundle[]>();
    for (const bundle of this.resolvedBundles) {
      const key = bundle.item.section;
      const group = grouped.get(key) ?? [];
      group.push(bundle);
      grouped.set(key, group);
    }

    // Build tab entries: only sections that have bundles.
    const tabEntries: Array<{ id: string; title: string }> = [];
    for (const section of sections) {
      if (grouped.has(section.id)) {
        tabEntries.push({ id: section.id, title: section.title });
      }
    }
    // Default section (ungrouped bundles).
    if (grouped.has(undefined)) {
      tabEntries.push({ id: "__default__", title: "General" });
    }

    // Resolve active tab.
    const hasTabs = tabEntries.length > 1;
    let activeId = this.activeSection;
    if (!activeId || !tabEntries.some((t) => t.id === activeId)) {
      // Use the section marked `active`, or fall back to first tab.
      const activeSection = sections.find((s) => s.active);
      activeId = activeSection && tabEntries.some((t) => t.id === activeSection.id)
        ? activeSection.id
        : tabEntries[0]?.id ?? null;
    }

    // Get bundles for the active tab.
    const activeBundles = activeId === "__default__"
      ? grouped.get(undefined) ?? []
      : grouped.get(activeId!) ?? [];

    return html`
      <div class="bundle-section">
        ${hasTabs
          ? html`
            <div class="section-tabs">
              ${tabEntries.map(
                (tab) => html`
                  <div
                    class="section-tab ${activeId === tab.id ? "active" : ""}"
                    @click=${() => { this.activeSection = tab.id; }}
                  >
                    ${tab.title}
                  </div>
                `
              )}
            </div>
          `
          : nothing}
        <div class="bundle-body">
          ${activeBundles.map((bundle) => html`
            <div class="bundle-cell">
              ${hasTabs
                ? nothing
                : html`<div class="bundle-label">${bundle.item.title}</div>`}
              <bees-bundle-frame
                .iframeBlobUrl=${this.iframeBlobUrl}
                .code=${bundle.code}
                .bundleCss=${bundle.css}
                .sdkHandlers=${handlers}
              ></bees-bundle-frame>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  /** Reload the surface — called on ticket change and by the parent on fs updates. */
  async loadSurface(): Promise<void> {
    if (!this.ticketStore || !this.ticketId) return;
    this.surface = await this.ticketStore.readSurface(this.ticketId);

    if (this.surface) {
      await this.#resolveBundles(this.surface);
    }
  }

  /** Whether a surface is currently loaded. */
  get hasSurface(): boolean {
    return this.surface !== null;
  }

  /**
   * Read bundle JS/CSS content for all `render: "bundle"` items and
   * prepare the iframe blob URL.
   */
  async #resolveBundles(surface: SurfaceManifest): Promise<void> {
    const bundleItems = surface.items.filter((i) => i.render === "bundle");
    if (bundleItems.length === 0) {
      this.resolvedBundles = [];
      return;
    }

    // Ensure iframe blob URL is ready (fetches React on first call).
    if (!this.iframeBlobUrl) {
      try {
        this.iframeBlobUrl = await getIframeBlobUrl();
      } catch (e) {
        console.error("[surface-pane] Failed to prepare iframe runtime:", e);
        return;
      }
    }

    const resolved: ResolvedBundle[] = [];
    for (const item of bundleItems) {
      if (!item.path) continue;

      const jsPath = item.path.split("/");
      const code = await this.ticketStore!.readFileContent(
        this.ticketId!,
        jsPath
      );
      if (!code) {
        console.warn(
          `[surface-pane] Could not read bundle JS: ${item.path}`
        );
        continue;
      }

      // Conventionally discover CSS by same stem: bundle.js → bundle.css
      const stem = item.path.replace(/\.js$/, "");
      const cssPath = (stem + ".css").split("/");
      const bundleCss = await this.ticketStore!.readFileContent(
        this.ticketId!,
        cssPath
      );

      resolved.push({ item, code, css: bundleCss });
    }

    this.resolvedBundles = resolved;
  }

  /** Build the SDK handler registry for this ticket context. */
  #makeSdkHandlers(): SdkHandlers {
    const store = this.ticketStore!;
    const ticketId = this.ticketId!;

    const handlers: SdkHandlers = new Map();

    handlers.set("readFile", async (path: unknown) => {
      const segments = String(path).split("/").filter(Boolean);
      return store.readFileContent(ticketId, segments);
    });

    handlers.set("navigateTo", async () => {
      // TODO: wire to hivetool navigation when needed.
    });

    handlers.set("emit", async () => {
      // TODO: wire to hivetool event bus when needed.
    });

    return handlers;
  }

  /** Load file content by path — passed to surface-view as contentLoader. */
  #contentLoader = async (path: string): Promise<string | null> => {
    if (!this.ticketStore || !this.ticketId) return null;
    const segments = path.split("/").filter(Boolean);
    return this.ticketStore.readFileContent(this.ticketId, segments);
  };

  /** Push an event to all active bundle frames in this surface. */
  #emitToFrames(event: string, detail?: unknown): void {
    const frames =
      this.renderRoot.querySelectorAll<BeesBundleFrame>("bees-bundle-frame");
    for (const frame of frames) {
      frame.emit(event, detail);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-surface-pane": BeesSurfacePane;
  }
}
