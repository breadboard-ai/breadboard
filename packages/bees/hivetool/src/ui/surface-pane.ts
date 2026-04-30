/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Full-pane surface view — the "Surface" tab body.
 *
 * Receives a ticket ID, reads root `surface.json` via the ticket store,
 * and renders the existing `<bees-surface-view>` in the full main area.
 * Re-reads surface data when the ticket ID changes or the filesystem
 * observer fires.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketStore } from "../data/ticket-store.js";
import type { SurfaceManifest } from "../data/types.js";
import { sharedStyles } from "./shared-styles.js";
import "./surface-view.js";

export { BeesSurfacePane };

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

  /** Track which ticket ID we last loaded for. */
  #loadedFor: string | null = null;

  render() {
    if (!this.ticketStore || !this.ticketId) {
      return html`<div class="empty-state">No surface available</div>`;
    }

    // Reload surface when ticket changes.
    if (this.#loadedFor !== this.ticketId) {
      this.surface = null;
      this.#loadedFor = this.ticketId;
      this.loadSurface();
    }

    if (!this.surface) return nothing;

    return html`
      <div class="surface-container">
        <bees-surface-view .surface=${this.surface}></bees-surface-view>
      </div>
    `;
  }

  /** Reload the surface — called on ticket change and by the parent on fs updates. */
  async loadSurface(): Promise<void> {
    if (!this.ticketStore || !this.ticketId) return;
    this.surface = await this.ticketStore.readSurface(this.ticketId);
  }

  /** Whether a surface is currently loaded. */
  get hasSurface(): boolean {
    return this.surface !== null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-surface-pane": BeesSurfacePane;
  }
}
