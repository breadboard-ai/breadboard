/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";
import { deriveChildAgents } from "../../sca/utils/agent-tree.js";
import type { TicketData } from "../../data/types.js";

/** Digest tile data written by the digest-tile-writer playbook. */
interface DigestTileData {
  title?: string;
  summary?: string;
  milestone?: string;
  actionable?: string;
  link_id?: string;
}

const styles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: var(--cg-color-surface, #fdfcfa);
    padding: var(--cg-sp-8, 32px) var(--cg-sp-10, 40px);
    box-sizing: border-box;
  }

  .panel-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .panel-title {
    font-size: var(--cg-text-headline-sm-size, 24px);
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
    margin-bottom: var(--cg-sp-6, 24px);
  }

  .agent-card {
    display: flex;
    align-items: center;
    gap: var(--cg-sp-4, 16px);
    padding: var(--cg-sp-4, 16px) var(--cg-sp-5, 20px);
    margin-bottom: var(--cg-sp-3, 12px);
    background: var(--cg-color-surface-container-lowest, #ffffff);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    border-radius: var(--cg-radius-lg, 16px);
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
    font-family: inherit;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }

  .agent-card:hover {
    background: var(--cg-color-surface-bright, #ffffff);
    transform: translateY(-1px);
    box-shadow: var(--cg-elevation-2, 0 4px 12px rgba(0, 0, 0, 0.06));
    border-color: var(--cg-color-primary, #3b5fc0);
  }

  .agent-status-icon {
    font-size: 20px;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--cg-radius-full, 999px);
    background: var(--cg-color-surface-container-high, #eae7e3);
  }

  .agent-status-icon.running {
    background: #ff980022;
  }

  .agent-status-icon.completed {
    background: #4caf5022;
  }

  .agent-status-icon.failed {
    background: rgba(186, 26, 26, 0.08);
  }

  .agent-info {
    flex: 1;
    min-width: 0;
  }

  .agent-name {
    font-size: var(--cg-text-body-md-size, 14px);
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-detail {
    font-size: var(--cg-text-body-sm-size, 12px);
    color: var(--cg-color-on-surface-muted, #79757f);
    text-transform: capitalize;
  }

  .agent-arrow {
    color: var(--cg-color-on-surface-muted, #79757f);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .agent-card:hover .agent-arrow {
    opacity: 1;
  }

  .dot-flashing {
    position: relative;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #ff9800;
    color: #ff9800;
    animation: dot-flashing 1s infinite linear alternate;
    animation-delay: 0.5s;
    margin-left: 8px;
    display: inline-block;
  }

  .dot-flashing::before,
  .dot-flashing::after {
    content: "";
    display: inline-block;
    position: absolute;
    top: 0;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: currentColor;
  }

  .dot-flashing::before {
    left: -8px;
    animation: dot-flashing 1s infinite alternate;
    animation-delay: 0s;
  }

  .dot-flashing::after {
    left: 8px;
    animation: dot-flashing 1s infinite alternate;
    animation-delay: 1s;
  }

  @keyframes dot-flashing {
    0% {
      opacity: 0.2;
    }
    50%,
    100% {
      opacity: 1;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: var(--cg-sp-10, 40px) 0;
    opacity: 0.6;
  }

  .empty-icon {
    font-size: 32px;
  }

  /* ── Enriched card (with digest tile) ── */

  .agent-card.enriched {
    flex-direction: column;
    align-items: stretch;
    gap: var(--cg-sp-2, 8px);
  }

  .agent-card-header {
    display: flex;
    align-items: center;
    gap: var(--cg-sp-4, 16px);
  }

  .digest-meta {
    display: flex;
    align-items: center;
    gap: var(--cg-sp-2, 8px);
    flex-wrap: wrap;
    padding-left: 48px;
  }

  .milestone-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: var(--cg-radius-full, 999px);
    font-size: 11px;
    font-weight: 500;
    background: var(--cg-color-tertiary-container, #f3e8f9);
    color: var(--cg-color-on-tertiary-container, #4a2260);
  }

  .actionable-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: var(--cg-radius-full, 999px);
    font-size: 11px;
    font-weight: 600;
    background: #ff980022;
    color: #e65100;
  }

  .digest-summary {
    font-size: var(--cg-text-body-sm-size, 12px);
    color: var(--cg-color-on-surface-muted, #79757f);
    line-height: 1.5;
    padding-left: 48px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

@customElement("opal-subagent-panel")
export class OpalSubagentPanel extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ type: String })
  accessor parentTicketId: string = "";

  static styles = [sharedStyles, styles];

  #digestTiles = new Map<string, DigestTileData>();
  #lastFetchKey = "";
  #fetching = false;

  render() {
    if (!this.parentTicketId) {
      return html`<div class="empty-state">
        <span class="empty-icon">🤖</span>
        No parent agent selected.
      </div>`;
    }

    const tickets = this.sca.controller.global.tickets;
    const children = deriveChildAgents(tickets, this.parentTicketId).sort(
      (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")
    );

    if (children.length === 0) {
      return html`<div class="empty-state">
        <span class="empty-icon">🤖</span>
        No subagents spawned yet.
      </div>`;
    }

    // Detect digest_ready signals to know when to re-fetch tiles.
    const digestReadyCount = tickets.filter(
      (t) => t.kind === "coordination" && t.signal_type === "digest_ready"
    ).length;
    const fetchKey = `${this.parentTicketId}:${digestReadyCount}`;
    if (fetchKey !== this.#lastFetchKey) {
      this.#lastFetchKey = fetchKey;
      this.#fetchDigestTiles(children);
    }

    return html`
      <div class="panel-container">
        <div class="panel-title">Subagents</div>
        ${children.map((child) => this.#renderCard(child))}
      </div>
    `;
  }

  #renderCard(child: TicketData) {
    const isRunning = child.status === "running";

    const icon =
      child.status === "completed"
        ? "✅"
        : child.status === "failed"
          ? "❌"
          : child.status === "paused"
            ? "⏸"
            : isRunning
              ? "⏳"
              : "📝";

    const digest = child.slug ? this.#digestTiles.get(child.slug) : undefined;

    const title =
      digest?.title ||
      child.title ||
      child.playbook_id?.replace(/-/g, " ") ||
      child.id.slice(0, 8);

    const detailText = isRunning
      ? "Working..."
      : child.status === "suspended"
        ? "Ready for your input"
        : child.status;

    const navigate = () => {
      this.sca.controller.agentTree.selectedAgentId = child.id;
    };

    if (digest) {
      return html`
        <button class="agent-card enriched" @click=${navigate}>
          <div class="agent-card-header">
            <div class="agent-status-icon ${child.status}">${icon}</div>
            <div class="agent-info">
              <div class="agent-name">${title}</div>
              <div class="agent-detail">
                ${detailText}
                ${isRunning ? html`<span class="dot-flashing"></span>` : ""}
              </div>
            </div>
            <span class="agent-arrow">→</span>
          </div>
          <div class="digest-meta">
            ${digest.milestone
              ? html`<span class="milestone-chip">📍 ${digest.milestone}</span>`
              : ""}
          </div>
          ${digest.summary
            ? html`<div class="digest-summary">${digest.summary}</div>`
            : ""}
        </button>
      `;
    }

    return html`
      <button class="agent-card" @click=${navigate}>
        <div class="agent-status-icon ${child.status}">${icon}</div>
        <div class="agent-info">
          <div class="agent-name">${title}</div>
          <div class="agent-detail">
            ${detailText}
            ${isRunning ? html`<span class="dot-flashing"></span>` : ""}
          </div>
        </div>
        <span class="agent-arrow">→</span>
      </button>
    `;
  }

  async #fetchDigestTiles(children: TicketData[]) {
    if (this.#fetching || !this.parentTicketId) return;
    this.#fetching = true;
    try {
      const api = this.sca.services.api;
      const allFiles = await api.listFiles(this.parentTicketId);
      const digestFiles = allFiles.filter((f) =>
        f.endsWith("digest_tile.json")
      );

      if (digestFiles.length === 0) {
        if (this.#digestTiles.size > 0) {
          this.#digestTiles = new Map();
          this.requestUpdate();
        }
        return;
      }

      const newTiles = new Map<string, DigestTileData>();

      for (const child of children) {
        if (!child.slug) continue;

        // Find the shallowest digest_tile.json under this child's slug.
        const matches = digestFiles
          .filter((f) => f.startsWith(child.slug + "/"))
          .sort((a, b) => a.split("/").length - b.split("/").length);

        if (matches.length === 0) continue;

        const content = await api.getFile(this.parentTicketId, matches[0]);
        if (content) {
          try {
            newTiles.set(child.slug!, JSON.parse(content));
          } catch {
            // Invalid JSON — skip.
          }
        }
      }

      this.#digestTiles = newTiles;
      this.requestUpdate();
    } finally {
      this.#fetching = false;
    }
  }
}
