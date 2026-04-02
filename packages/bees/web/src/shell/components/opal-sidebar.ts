/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import { sharedStyles } from "./shared.styles.js";

import { switchThread } from "../../sca/actions/chat/chat-actions.js";

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

  .journey-item {
    display: flex;
    flex-direction: column;
    padding: var(--cg-sp-4, 16px);
    margin-bottom: var(--cg-sp-3, 12px);
    border-radius: var(--cg-radius-md, 12px);
    background: var(--cg-color-surface, #fdfcfa);
    border: 1px solid var(--cg-color-outline-variant, #e0ddd9);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    text-align: left;
    width: 100%;
    position: relative;
    overflow: hidden;
  }

  .journey-item:hover {
    background: var(--cg-color-surface-bright, #ffffff);
    transform: translateY(-2px);
    box-shadow: var(--cg-elevation-2, 0 4px 12px rgba(0, 0, 0, 0.06));
    border-color: var(--cg-color-primary, #3b5fc0);
  }

  .journey-item.active {
    background: var(--cg-color-primary-container, #dbe1f9);
    border-color: var(--cg-color-primary, #3b5fc0);
    box-shadow: var(--cg-elevation-1, 0 1px 3px rgba(0, 0, 0, 0.06));
  }

  .journey-item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: calc(50% - 12px);
    height: 24px;
    width: 4px;
    background: var(--cg-color-primary, #3b5fc0);
    border-radius: 0 var(--cg-radius-sm, 4px) var(--cg-radius-sm, 4px) 0;
  }

  .journey-title {
    font-size: var(--cg-text-body-md-size, 14px);
    font-weight: 600;
    color: var(--cg-color-on-surface, #1c1b1f);
    margin-bottom: var(--cg-sp-1, 4px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .journey-status {
    font-size: var(--cg-text-body-sm-size, 12px);
    color: var(--cg-color-on-surface-muted, #79757f);
    display: flex;
    align-items: center;
    gap: var(--cg-sp-2, 8px);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cg-color-primary, #3b5fc0);
    position: relative;
  }

  .status-dot.active-running {
    background: #ff9800; /* Rich Amber */
    box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2);
  }

  .status-dot.success {
    background: #4caf50;
  }

  .status-dot.error {
    background: var(--cg-color-error, #ba1a1a);
  }
`;

@customElement("opal-sidebar")
export class OpalSidebar extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [sharedStyles, styles];

  render() {
    const global = this.sca.controller.global;
    const chat = this.sca.controller.chat;
    const pulseTasks = global.pulseTasks;

    // Combine threads with pulse status
    const journeys = chat.threads.filter((t) => t.id !== "opie");

    return html`
      <div class="sidebar-section">
        <div class="section-title">Journeys</div>
        ${journeys.length === 0
          ? html`
              <div
                class="journey-status"
                style="padding: var(--cg-sp-3); opacity: 0.7;"
              >
                No journeys started yet
              </div>
            `
          : journeys.map((t) => {
              // Check if any ticket in this thread is currently tracked by pulse
              const activePulse = pulseTasks.find(
                (pt) =>
                  pt.id === t.activeTicketId || t.ticketIds.includes(pt.id)
              );
              const isActive = activePulse !== undefined;

              return html`
                <button
                  class="journey-item ${t.id === chat.activeThreadId
                    ? "active"
                    : ""}"
                  @click=${() =>
                    switchThread(new CustomEvent("switch", { detail: t.id }))}
                >
                  <div class="journey-title">${t.title}</div>
                  <div class="journey-status">
                    <span
                      class="status-dot ${isActive
                        ? "active-running"
                        : "success"}"
                    ></span>
                    ${isActive
                      ? activePulse.current_step || "Running..."
                      : "Ready"}
                  </div>
                </button>
              `;
            })}
      </div>
    `;
  }
}
