/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Full-pane surface view — the "Surface" tab body.
 *
 * Receives a ticket ID, reads root `surface.json` via the ticket store,
 * and renders the surface. Items with `render: "bundle"` are rendered
 * as live sandboxed iframes via `<bees-bundle-frame>`. Other items
 * render as static cards via `<bees-surface-view>`.
 *
 * Re-reads surface data when the ticket ID changes or the filesystem
 * observer fires.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketStore } from "../data/ticket-store.js";
import type { SurfaceManifest, SurfaceItem } from "../data/types.js";
import type { SdkHandlers } from "../../../common/bundle-types.js";
import { getIframeBlobUrl } from "./react-cache.js";
import { sharedStyles } from "./shared-styles.js";
import "./surface-view.js";
import "./bundle-frame.js";

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

      .surface-container {
        padding: 24px 32px;
        max-width: 960px;
        margin: 0 auto;
        width: 100%;
      }

      .bundle-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 16px;
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

  @property({ type: String })
  accessor ticketId: string | null = null;

  @state() accessor surface: SurfaceManifest | null = null;
  @state() accessor resolvedBundles: ResolvedBundle[] = [];
  @state() accessor iframeBlobUrl: string | null = null;

  /** Track which ticket ID we last loaded for. */
  #loadedFor: string | null = null;

  render() {
    if (!this.ticketStore || !this.ticketId) {
      return html`<div class="empty-state">No surface available</div>`;
    }

    // Reload surface when ticket changes.
    if (this.#loadedFor !== this.ticketId) {
      this.surface = null;
      this.resolvedBundles = [];
      this.#loadedFor = this.ticketId;
      this.loadSurface();
    }

    if (!this.surface) return nothing;

    // Split items into bundles and non-bundles.
    const nonBundleItems = this.surface.items.filter(
      (i) => i.render !== "bundle"
    );
    const nonBundleSurface: SurfaceManifest = {
      ...this.surface,
      items: nonBundleItems,
    };
    const hasBundles = this.resolvedBundles.length > 0;
    const hasNonBundles = nonBundleItems.length > 0;

    return html`
      <div class="surface-container">
        ${hasBundles ? this.renderBundles() : nothing}
        ${hasNonBundles
          ? html`<bees-surface-view
              .surface=${nonBundleSurface}
            ></bees-surface-view>`
          : nothing}
      </div>
    `;
  }

  private renderBundles() {
    const handlers = this.#makeSdkHandlers();

    return html`
      <div class="bundle-section">
        ${this.resolvedBundles.map(
          (bundle) => html`
            <div>
              <div class="bundle-label">${bundle.item.title}</div>
              <bees-bundle-frame
                .iframeBlobUrl=${this.iframeBlobUrl}
                .code=${bundle.code}
                .bundleCss=${bundle.css}
                .sdkHandlers=${handlers}
              ></bees-bundle-frame>
            </div>
          `
        )}
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
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-surface-pane": BeesSurfacePane;
  }
}
