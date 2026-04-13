/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sidebar list of tickets with flat/tree toggle.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { TicketData } from "../data/types.js";
import type { TicketStore } from "../data/ticket-store.js";
import { deriveTicketTree, type TicketTreeNode } from "../data/ticket-tree.js";
import { getRelativeTime } from "../utils.js";
import { sharedStyles } from "./shared-styles.js";

export { BeesTicketList };

type TicketViewMode = "flat" | "tree";
const VIEW_MODE_KEY = "bees-hivetool-ticket-view-mode";

@customElement("bees-ticket-list")
class BeesTicketList extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      /* Sidebar toolbar */
      .sidebar-toolbar {
        display: flex;
        justify-content: flex-end;
        padding: 8px 12px 0;
        flex-shrink: 0;
      }

      .view-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        font-size: 0.8rem;
        background: transparent;
        color: #64748b;
        border: 1px solid #334155;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .view-toggle:hover {
        color: #e2e8f0;
        border-color: #3b82f6;
        background: #1e293b;
      }

      .view-toggle.active {
        color: #60a5fa;
        border-color: #3b82f6;
        background: #1e293b33;
      }

      /* Ticket tree */
      .ticket-tree-branch {
        border: none;
        margin: 0;
      }

      .ticket-tree-branch > summary {
        list-style: none;
        cursor: default;
      }

      .ticket-tree-branch > summary::-webkit-details-marker {
        display: none;
      }

      .ticket-tree-children {
        margin-left: 16px;
        border-left: 1px solid #1e293b;
        padding-left: 4px;
      }
    `,
  ];

  @property({ attribute: false })
  accessor store: TicketStore | null = null;

  /** ID of a recently updated ticket (for flash animation). */
  @property({ attribute: false })
  accessor flashTicketId: string | null = null;

  @state() accessor viewMode: TicketViewMode =
    (localStorage.getItem(VIEW_MODE_KEY) as TicketViewMode) || "flat";

  render() {
    if (!this.store) return nothing;
    const allTickets = this.store.tickets.get();
    const tickets = allTickets.filter((t) => t.kind !== "coordination");
    const selectedId = this.store.selectedTicketId.get();

    if (tickets.length === 0) {
      return html`<div class="empty-state">No tickets found.</div>`;
    }

    const isTree = this.viewMode === "tree";

    return html`
      <div class="sidebar-toolbar">
        <button
          class="view-toggle ${isTree ? "active" : ""}"
          @click=${() => this.toggleViewMode()}
          title="${isTree ? "Switch to flat list" : "Switch to tree view"}"
        >
          ${isTree ? "🌳" : "☰"}
        </button>
      </div>
      <div class="jobs-list">
        ${isTree
          ? this.renderTree(tickets, selectedId)
          : tickets.map((t) => this.renderItem(t, selectedId))}
      </div>
    `;
  }

  private renderItem(t: TicketData, selectedId: string | null) {
    return html`
      <div
        class="job-item ${selectedId === t.id ? "selected" : ""} ${this
          .flashTicketId === t.id
          ? "lightning-flash"
          : ""}"
        @click=${() => this.handleSelect(t.id)}
      >
        <div class="job-header">
          <div class="job-title">${t.title || t.id.slice(0, 8)}</div>
          <div class="job-status ${t.status}"></div>
        </div>
        <div class="job-meta">
          <span>${t.playbook_id ?? "ad-hoc"}</span>
          <span>${getRelativeTime(t.created_at)}</span>
        </div>
        ${t.tags && t.tags.length > 0
          ? html`
              <div class="job-meta">
                ${t.tags.map(
                  (tag) =>
                    html`<span
                      class="tool-badge"
                      style="font-size:0.65rem;padding:1px 5px"
                      >${tag}</span
                    >`
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderTree(tickets: TicketData[], selectedId: string | null) {
    const tree = deriveTicketTree(tickets);
    return tree.map((node) => this.renderTreeNode(node, selectedId));
  }

  private renderTreeNode(
    node: TicketTreeNode,
    selectedId: string | null
  ): unknown {
    const t = node.ticket;
    const hasChildren = node.children.length > 0;
    const item = this.renderItem(t, selectedId);

    if (!hasChildren) return item;

    return html`
      <details class="ticket-tree-branch" open>
        <summary>${item}</summary>
        <div class="ticket-tree-children">
          ${node.children.map((child) =>
            this.renderTreeNode(child, selectedId)
          )}
        </div>
      </details>
    `;
  }

  private toggleViewMode() {
    this.viewMode = this.viewMode === "flat" ? "tree" : "flat";
    localStorage.setItem(VIEW_MODE_KEY, this.viewMode);
  }

  private handleSelect(id: string) {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { id }, bubbles: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-ticket-list": BeesTicketList;
  }
}
