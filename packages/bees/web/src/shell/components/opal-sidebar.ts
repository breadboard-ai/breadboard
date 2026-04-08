/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";

import { selectAgent } from "../../sca/actions/tree/tree-actions.js";
import {
  deriveAgentTree,
  derivePerspectives,
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
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--cg-color-on-surface-muted, #79757f);
    transition: transform 0.15s ease;
    flex-shrink: 0;
    user-select: none;
  }

  .expand-toggle.expanded {
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

  /** Set of expanded node IDs. */
  @state() accessor expandedIds: Set<string> = new Set();

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

  #renderNode(
    node: AgentTreeNode,
    selectedId: string | null,
    allTickets: TicketData[]
  ): TemplateResult {
    const t = node.ticket;
    const hasChildren = node.children.length > 0;
    const isExpanded = this.expandedIds.has(t.id);
    const isSelected = t.id === selectedId;
    const perspectives = derivePerspectives(t, allTickets);
    const pulseTasks = this.sca.controller.global.pulseTasks;
    const isRunning = pulseTasks.some((pt) => pt.id === t.id);
    const displayStatus = isRunning ? "running" : t.status;

    const title = t.title || t.playbook_id?.replace(/-/g, " ") || t.id.slice(0, 8);

    return html`
      <div class="tree-node">
        <button
          class="node-row ${isSelected ? "selected" : ""}"
          @click=${() => this.#selectNode(t.id)}
        >
          <span
            class="expand-toggle ${hasChildren ? (isExpanded ? "expanded" : "") : "leaf"}"
            @click=${(e: Event) => {
              if (hasChildren) {
                e.stopPropagation();
                this.#toggleExpand(t.id);
              }
            }}
          >▸</span>
          <span class="status-dot ${displayStatus}"></span>
          <span class="node-title">${title}</span>
          <span class="perspective-icons">
            ${perspectives.hasChat ? "💬" : nothing}
            ${perspectives.hasBundle ? "🖥" : nothing}
            ${perspectives.hasSubagents ? "👥" : nothing}
          </span>
        </button>
        ${hasChildren && isExpanded
          ? html`
              <div class="children">
                ${node.children.map((child) =>
                  this.#renderNode(child, selectedId, allTickets)
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  #selectNode(id: string) {
    selectAgent(new CustomEvent("select", { detail: id }));
  }

  #toggleExpand(id: string) {
    const next = new Set(this.expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedIds = next;
  }
}
