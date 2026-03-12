// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Presence sidebar — shows who's online using Yjs awareness,
 * plus a permanent Gemini agent entry that activates circle-select.
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { awareness, doc } from "./sync.js";

interface AwarenessUser {
  name: string;
  color: string;
  focus?: string;
}

interface PresenceEntry {
  clientId: number;
  user: AwarenessUser;
}

interface AgentStatus {
  status: "thinking" | "writing" | "error";
  target?: string;
  message?: string;
}

@customElement("party-presence")
export class PartyPresence extends LitElement {
  static styles = css`
    :host { display: block; }

    h2 {
      font-size: 14px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--color-text-muted, #8888a0);
      margin-bottom: 12px;
    }

    .user-list {
      display: flex; flex-direction: column; gap: 8px;
    }

    .user-entry {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 6px;
      background: var(--color-surface-alt, #22222e);
      font-size: 14px;
    }

    .dot {
      width: 8px; height: 8px;
      border-radius: 50%; flex-shrink: 0;
    }

    .name { font-weight: 500; }
    .focus {
      font-size: 11px; color: var(--color-text-muted, #8888a0);
      margin-left: auto;
    }

    .empty {
      font-size: 13px; color: var(--color-text-muted, #8888a0);
      font-style: italic;
    }

    /* ── Agent entry ──────────────────────────────────── */

    .agent-entry {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 6px;
      background: var(--color-surface-alt, #22222e);
      border: 1px solid transparent;
      font-size: 14px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: border-color 0.2s, background 0.2s;
      user-select: none;
    }

    .agent-entry:hover {
      border-color: var(--color-accent, #7c6cff)44;
      background: linear-gradient(
        135deg,
        var(--color-accent, #7c6cff)10,
        var(--color-surface-alt, #22222e)
      );
    }

    .agent-entry.busy {
      background: linear-gradient(
        135deg,
        var(--color-accent, #7c6cff)10,
        var(--color-surface-alt, #22222e)
      );
      border-color: var(--color-accent, #7c6cff)33;
      cursor: default;
      animation: agent-glow 2s ease-in-out infinite;
    }

    @keyframes agent-glow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }

    .agent-dot {
      width: 8px; height: 8px;
      border-radius: 50%; flex-shrink: 0;
      background: var(--color-text-muted, #8888a0);
      transition: background 0.3s, box-shadow 0.3s;
    }

    .agent-entry.busy .agent-dot {
      background: var(--color-accent, #7c6cff);
      animation: agent-pulse 1s ease-in-out infinite;
    }

    @keyframes agent-pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 4px var(--color-accent, #7c6cff); }
      50% { transform: scale(1.3); box-shadow: 0 0 10px var(--color-accent, #7c6cff); }
    }

    .agent-status {
      font-size: 11px;
      color: var(--color-accent, #7c6cff);
      margin-left: auto;
    }

    .agent-hint {
      font-size: 11px;
      color: var(--color-text-muted, #8888a0);
      margin-left: auto;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .agent-entry:hover .agent-hint {
      opacity: 1;
    }

    /* ── Ripple ──────────────────────────────────────── */

    .ripple {
      position: absolute;
      border-radius: 50%;
      background: var(--color-accent, #7c6cff);
      opacity: 0.4;
      transform: scale(0);
      animation: ripple-expand 0.6s ease-out forwards;
      pointer-events: none;
    }

    @keyframes ripple-expand {
      to { transform: scale(4); opacity: 0; }
    }
  `;

  @state() private users: PresenceEntry[] = [];
  @state() private agent: AgentStatus | null = null;

  connectedCallback() {
    super.connectedCallback();
    awareness.on("change", this.#handleAwarenessChange);
    this.#handleAwarenessChange();

    const root = doc.getMap("state");
    root.observe(this.#handleAgentChange);
    this.#handleAgentChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    awareness.off("change", this.#handleAwarenessChange);
    const root = doc.getMap("state");
    root.unobserve(this.#handleAgentChange);
  }

  #handleAwarenessChange = () => {
    const states = awareness.getStates() as Map<
      number,
      { user?: AwarenessUser }
    >;
    const entries: PresenceEntry[] = [];
    for (const [clientId, state] of states) {
      if (state.user) {
        entries.push({ clientId, user: state.user });
      }
    }
    this.users = entries;
  };

  #handleAgentChange = () => {
    const root = doc.getMap("state");
    const agentVal = root.get("_agent") as AgentStatus | null;
    this.agent = agentVal ?? null;
  };

  #handleAgentClick(e: MouseEvent) {
    // Don't activate if agent is already working.
    if (this.agent) return;

    // Spawn ripple from click point.
    const entry = (e.currentTarget as HTMLElement);
    const rect = entry.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    entry.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());

    // Fire activation event for the parent app.
    this.dispatchEvent(new CustomEvent("gemini-activate", {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const busy = !!this.agent;
    const isError = this.agent?.status === "error";
    const statusText = this.agent?.status === "thinking"
      ? "thinking…"
      : this.agent?.status === "writing"
        ? "writing…"
        : isError
          ? "error!"
          : null;

    return html`
      <h2>Online</h2>
      <div class="user-list">
        ${this.users.map(
          (entry) => html`
            <div class="user-entry">
              <span class="dot" style="background: ${entry.user.color}"></span>
              <span class="name">${entry.user.name}</span>
              ${entry.user.focus
                ? html`<span class="focus">${entry.user.focus}</span>`
                : ""}
            </div>
          `
        )}

        <div
          class="agent-entry ${busy ? "busy" : ""}"
          @click=${this.#handleAgentClick}
        >
          <span class="agent-dot"></span>
          <span class="name">🤖 Gemini</span>
          ${statusText
            ? html`<span class="agent-status" style="${isError ? "color: #ff4444;" : ""}">${statusText}</span>`
            : html`<span class="agent-hint">circle ✨</span>`}
        </div>
      </div>
    `;
  }
}

