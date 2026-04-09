/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";

import { selectAgent } from "../../sca/actions/tree/tree-actions.js";
import {
  deriveAgentTree,
  derivePerspectives,
  deriveAncestorPath,
  type AgentTreeNode,
} from "../../sca/utils/agent-tree.js";
import type { TicketData } from "../../data/types.js";

const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 280px;
    background: var(--cg-color-surface-dim, #f5f3f0);
    border-right: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    padding: var(--cg-sp-6, 24px);
    box-sizing: border-box;
    overflow-y: auto;
  }

  .sidebar-section {
    margin-bottom: var(--cg-sp-8, 32px);
  }

  .section-title {
    font-size: var(--cg-text-label-sm-size, 11px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--cg-color-on-surface-muted, #79757f);
    margin-bottom: var(--cg-sp-4, 16px);
  }

  /* ── Tree nodes ── */

  .tree-node {
    margin-bottom: var(--cg-sp-1, 4px);
  }

  .tree-node.new-node {
    animation: slideIn 0.3s cubic-bezier(0.2, 0, 0, 1) forwards;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* ── <details>/<summary> reset ── */

  details {
    margin-bottom: var(--cg-sp-1, 4px);
  }

  summary {
    list-style: none;
  }

  summary::-webkit-details-marker,
  summary::marker {
    display: none;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: var(--cg-sp-2, 8px);
    padding: var(--cg-sp-2, 8px) var(--cg-sp-3, 12px);
    border-radius: var(--cg-radius-md, 12px);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
    text-align: left;
    width: 100%;
    position: relative;
    font-family: inherit;
    font-size: var(--cg-text-body-md-size, 14px);
    color: var(--cg-color-on-surface, #1c1b1f);
    box-sizing: border-box;
  }

  .node-row:hover {
    background: var(--cg-color-surface-bright, #ffffff);
    border-color: var(--cg-color-outline-variant, #e0ddd9);
  }

  .node-row.selected {
    background: var(--cg-color-primary-container, #dbe1f9);
    border-color: var(--cg-color-primary, #3b5fc0);
  }

  .node-row.selected::before {
    content: "";
    position: absolute;
    left: 0;
    top: calc(50% - 10px);
    height: 20px;
    width: 3px;
    background: var(--cg-color-primary, #3b5fc0);
    border-radius: 0 var(--cg-radius-sm, 4px) var(--cg-radius-sm, 4px) 0;
  }

  .expand-toggle {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cg-color-on-surface-muted, #79757f);
    transition: transform 0.15s ease;
    flex-shrink: 0;
    user-select: none;
  }

  .expand-toggle svg {
    width: 12px;
    height: 12px;
  }

  details[open] > summary .expand-toggle {
    transform: rotate(90deg);
  }

  .expand-toggle.leaf {
    visibility: hidden;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot.running {
    background: #ff9800;
    box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2);
  }

  .status-dot.completed {
    background: #4caf50;
  }

  .status-dot.failed {
    background: var(--cg-color-error, #ba1a1a);
  }

  .status-dot.paused {
    background: #ff9800;
  }

  .status-dot.available,
  .status-dot.blocked,
  .status-dot.suspended {
    background: var(--cg-color-primary, #3b5fc0);
  }

  .status-dot.pulse {
    animation: statusPulse 0.6s cubic-bezier(0.2, 0, 0, 1);
  }

  @keyframes statusPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 currentColor;
    }
    50% {
      transform: scale(1.6);
      box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.1);
    }
    100% {
      transform: scale(1);
      box-shadow: none;
    }
  }

  .node-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .perspective-icons {
    display: flex;
    gap: 2px;
    font-size: 11px;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .children {
    margin-left: var(--cg-sp-4, 16px);
    border-left: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    padding-left: var(--cg-sp-2, 8px);
  }

  .empty-state {
    padding: var(--cg-sp-3, 12px);
    opacity: 0.7;
    font-size: var(--cg-text-body-sm-size, 12px);
    color: var(--cg-color-on-surface-muted, #79757f);
  }
`;

@customElement("opal-sidebar")
export class OpalSidebar extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  /** Track known ticket IDs to detect new arrivals for entrance animation. */
  #knownTicketIds = new Set<string>();
  /** Track previous statuses for pulse animation. */
  #previousStatuses = new Map<string, string>();

  static styles = [sharedStyles, styles];

  render() {
    const tickets = this.sca.controller.global.tickets;
    const tree = deriveAgentTree(tickets);
    const selectedId = this.sca.controller.agentTree.selectedAgentId;

    return html`
      <div class="sidebar-section">
        <div class="section-title">Agents</div>
        ${tree.length === 0
          ? html`<div class="empty-state">No agents running yet</div>`
          : tree.map((node) =>
              this.#renderNode(node, selectedId, tickets)
            )}
      </div>
    `;
  }

  updated() {
    const tickets = this.sca.controller.global.tickets;
    const pulseTasks = this.sca.controller.global.pulseTasks;

    // Detect newly running agents and auto-expand their ancestor path.
    for (const ticket of tickets) {
      const wasRunning = pulseTasks.some((pt) => pt.id === ticket.id);
      const isNew = !this.#knownTicketIds.has(ticket.id);

      if ((isNew || wasRunning) && ticket.creator_ticket_id) {
        const ancestorPath = deriveAncestorPath(tickets, ticket.id);
        // Set `open` on all ancestor <details> elements.
        for (const ancestorId of ancestorPath) {
          const details = this.renderRoot.querySelector(
            `details[data-agent-id="${ancestorId}"]`
          );
          if (details && !details.hasAttribute("open")) {
            details.setAttribute("open", "");
          }
        }
      }
    }

    // Update status tracking for pulse detection, and track new tickets.
    for (const ticket of tickets) {
      this.#previousStatuses.set(ticket.id, ticket.status);
      this.#knownTicketIds.add(ticket.id);
    }
  }

  #renderNode(
    node: AgentTreeNode,
    selectedId: string | null,
    allTickets: TicketData[]
  ): TemplateResult | typeof nothing {
    const t = node.ticket;
    const perspectives = derivePerspectives(t, allTickets);

    // Hide agents with no interesting perspectives — they're noise.
    const hasAnyPerspective =
      perspectives.hasChat || perspectives.hasBundle || perspectives.hasSubagents;
    if (!hasAnyPerspective) return nothing;

    const hasChildren = node.children.length > 0;
    const isSelected = t.id === selectedId;
    const pulseTasks = this.sca.controller.global.pulseTasks;
    const isRunning = pulseTasks.some((pt) => pt.id === t.id);
    const displayStatus = isRunning ? "running" : t.status;

    const isNewNode = !this.#knownTicketIds.has(t.id);
    const previousStatus = this.#previousStatuses.get(t.id);
    const statusChanged = previousStatus !== undefined && previousStatus !== t.status;

    const title = t.title || t.playbook_id?.replace(/-/g, " ") || t.id.slice(0, 8);

    const nodeRow = html`
      <div
        class="node-row ${isSelected ? "selected" : ""}"
        @click=${() => this.#selectNode(t.id)}
      >
        <span class="expand-toggle ${hasChildren ? "" : "leaf"}"
          ><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6l6 6-6 6z"/></svg></span>
        <span class="status-dot ${displayStatus} ${statusChanged ? "pulse" : ""}"></span>
        <span class="node-title">${title}</span>
        <span class="perspective-icons">
          ${perspectives.hasChat ? "💬" : nothing}
          ${perspectives.hasBundle ? "🖥" : nothing}
          ${perspectives.hasSubagents ? "👥" : nothing}
        </span>
      </div>
    `;

    // Leaf node — no <details> needed.
    if (!hasChildren) {
      return html`
        <div class="tree-node ${isNewNode ? "new-node" : ""}">
          ${nodeRow}
        </div>
      `;
    }

    // Branch node — use <details>/<summary> for native expand/collapse.
    return html`
      <details class="tree-node ${isNewNode ? "new-node" : ""}" data-agent-id=${t.id}>
        <summary>${nodeRow}</summary>
        <div class="children">
          ${node.children.map((child) =>
            this.#renderNode(child, selectedId, allTickets)
          )}
        </div>
      </details>
    `;
  }

  #selectNode(id: string) {
    selectAgent(new CustomEvent("select", { detail: id }));
  }
}
