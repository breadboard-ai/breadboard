/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

interface TicketData {
  id: string;
  objective: string;
  status: string;
  created_at?: string;
  completed_at?: string;
  turns?: number;
  thoughts?: number;
  outcome?: string;
  error?: string;
  assignee?: string;
  suspend_event?: Record<string, unknown>;
  depends_on?: string[];
  events_log?: Array<Record<string, unknown>>;
  tags?: string[];
}

@customElement("bees-app")
export class BeesApp extends LitElement {
  @state() private tickets: TicketData[] = [];
  @state() private objective = "";
  @state() private tagsText = "";
  @state() private filterTag = "";
  @state() private editingTagsId = "";
  @state() private editedTagsText = "";
  @state() private draining = false;
  @state() private responses: Record<string, string> = {};

  private eventSource: EventSource | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
      gap: 24px;
    }

    header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    header h1 span {
      color: var(--accent);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      animation: pulse 2s ease-in-out infinite;
    }

    .status-dot.draining {
      background: var(--accent);
      animation: pulse 0.8s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Add form */
    .add-form {
      display: flex;
      gap: 8px;
    }

    .add-form input {
      flex: 1;
      padding: 12px 16px;
      font-family: var(--font-mono);
      font-size: 0.875rem;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-primary);
      transition: border-color 0.15s;
    }

    .add-form input::placeholder {
      color: var(--text-dim);
    }

    .add-form input:focus {
      border-color: var(--accent);
      outline: none;
    }

    .add-form button {
      padding: 12px 20px;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 600;
      background: var(--accent);
      color: var(--bg-primary);
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      transition: opacity 0.15s;
      white-space: nowrap;
    }

    .add-form button:hover {
      opacity: 0.85;
    }

    .add-form button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Ticket list */
    .tickets {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      flex: 1;
    }

    .ticket {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;
      transition: border-color 0.15s;
    }

    .ticket:hover {
      border-color: var(--border-hover);
    }

    .ticket-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .ticket-id {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge.available { background: var(--blue-dim); color: var(--blue); }
    .badge.blocked { background: var(--purple-dim); color: var(--purple); }
    .badge.running { background: var(--accent-dim); color: var(--accent); }
    .badge.suspended { background: var(--orange-dim); color: var(--orange); }
    .badge.completed { background: var(--green-dim); color: var(--green); }
    .badge.failed { background: var(--red-dim); color: var(--red); }

    .ticket-objective {
      font-size: 0.875rem;
      color: var(--text-primary);
      line-height: 1.5;
      font-family: var(--font-mono);
    }

    .ticket-deps {
      margin-top: 6px;
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    .ticket-deps code {
      color: var(--purple);
    }

    .ticket-outcome {
      margin-top: 10px;
      padding: 10px 12px;
      background: var(--bg-input);
      border-radius: var(--radius);
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.5;
      max-height: 120px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    .ticket-error {
      margin-top: 10px;
      padding: 8px 12px;
      background: var(--red-dim);
      border-radius: var(--radius);
      font-size: 0.8rem;
      color: var(--red);
    }

    /* Respond widget */
    .respond-prompt {
      margin-top: 10px;
      padding: 10px 12px;
      background: var(--orange-dim);
      border-radius: var(--radius);
      font-size: 0.8rem;
      color: var(--orange);
    }

    .respond-form {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .respond-form input {
      flex: 1;
      padding: 8px 12px;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-primary);
    }

    .respond-form input:focus {
      border-color: var(--orange);
      outline: none;
    }

    .respond-form button {
      padding: 8px 14px;
      font-size: 0.8rem;
      font-weight: 600;
      background: var(--orange);
      color: var(--bg-primary);
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--text-dim);
      font-size: 0.9rem;
    }

    .metrics {
      display: flex;
      gap: 12px;
      margin-top: 6px;
      font-size: 0.7rem;
      color: var(--text-dim);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.connectSSE();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.eventSource?.close();
  }

  private connectSSE() {
    this.eventSource = new EventSource("/events");

    this.eventSource.addEventListener("init", (e: MessageEvent) => {
      this.tickets = JSON.parse(e.data);
    });

    this.eventSource.addEventListener("ticket_added", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.upsertTicket(data.ticket);
    });

    this.eventSource.addEventListener("ticket_update", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.upsertTicket(data.ticket);
    });

    this.eventSource.addEventListener("session_event", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const { ticket_id, event } = data;
      const idx = this.tickets.findIndex((t) => t.id === ticket_id);
      if (idx >= 0) {
        const updated = [...this.tickets];
        const t = { ...updated[idx] };
        t.events_log = [...(t.events_log || []), event];
        updated[idx] = t;
        this.tickets = updated;
      }
    });

    this.eventSource.addEventListener("drain_start", () => {
      this.draining = true;
    });

    this.eventSource.addEventListener("drain_complete", () => {
      this.draining = false;
    });

    this.eventSource.addEventListener("drain_error", () => {
      this.draining = false;
    });

    this.eventSource.onerror = () => {
      // Reconnect after a brief delay.
      this.eventSource?.close();
      setTimeout(() => this.connectSSE(), 2000);
    };
  }

  private upsertTicket(ticket: TicketData) {
    const idx = this.tickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      const updated = [...this.tickets];
      updated[idx] = ticket;
      this.tickets = updated;
    } else {
      this.tickets = [ticket, ...this.tickets];
    }
  }

  private async addTicket() {
    const text = this.objective.trim();
    if (!text) return;
    const tags = this.tagsText.split(",").map(t => t.trim()).filter(Boolean);
    
    this.objective = "";
    this.tagsText = "";

    await fetch("/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: text, tags: tags.length ? tags : undefined }),
    });
  }

  private getRelativeTime(isoString?: string): string {
    if (!isoString) return "";
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
    if (diffHr > 0) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
    if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
    if (diffSec > 0) return `${diffSec} second${diffSec > 1 ? "s" : ""} ago`;
    return "just now";
  }

  private async saveEditedTags(ticketId: string) {
    const tags = this.editedTagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const resp = await fetch(`http://localhost:3200/tickets/${ticketId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (resp.ok) {
        this.editingTagsId = "";
      } else {
        console.error("Failed to save tags");
      }
    } catch (e) {
      console.error("Error saving tags:", e);
    }
  }

  private async respond(ticketId: string) {
    const text = this.responses[ticketId]?.trim();
    if (!text) return;

    // Clear input.
    this.responses = { ...this.responses, [ticketId]: "" };

    await fetch(`/tickets/${ticketId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") this.addTicket();
  }

  private onRespondKeyDown(e: KeyboardEvent, ticketId: string) {
    if (e.key === "Enter") this.respond(ticketId);
  }

  private extractPrompt(ticket: TicketData): string {
    const se = ticket.suspend_event;
    if (!se) return "(no prompt)";
    for (const key of ["waitForInput", "waitForChoice"]) {
      const payload = se[key] as Record<string, unknown> | undefined;
      if (!payload) continue;
      const prompt = payload.prompt as Record<string, unknown> | undefined;
      const parts = (prompt?.parts as Array<Record<string, string>>) ?? [];
      const texts = parts.filter((p) => p.text).map((p) => p.text);
      if (texts.length) return texts.join("\n");
    }
    return "(no prompt)";
  }

  render() {
    return html`
      <header style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="status-dot ${this.draining ? "draining" : ""}"></div>
          <h1>🐝 <span>Bees</span></h1>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            type="text"
            placeholder="Filter by tag..."
            .value=${this.filterTag}
            @input=${(e: Event) => (this.filterTag = (e.target as HTMLInputElement).value)}
            style="padding: 4px; background: var(--bg-input); color: var(--text); border: none; border-radius: 4px;"
          />
        </div>
      </header>

      <div class="add-form">
        <input
          type="text"
          placeholder="Enter objective... (use {{id}} for deps)"
          .value=${this.objective}
          @input=${(e: Event) =>
            (this.objective = (e.target as HTMLInputElement).value)}
          @keydown=${this.onKeyDown}
          style="flex: 2;"
        />
        <input
          type="text"
          placeholder="Tags (comma separated)..."
          .value=${this.tagsText}
          @input=${(e: Event) =>
            (this.tagsText = (e.target as HTMLInputElement).value)}
          @keydown=${this.onKeyDown}
          style="flex: 1;"
        />
        <button
          @click=${this.addTicket}
          ?disabled=${!this.objective.trim()}
        >
          Add Ticket
        </button>
      </div>

      ${this.tickets.length === 0
        ? html`<div class="empty">No tickets yet. Add one above.</div>`
        : html`
            ${(() => {
              const visibleTickets = this.tickets.filter(
                (t) =>
                  !this.filterTag.trim() ||
                  (t.tags &&
                    t.tags.some((tag) =>
                      tag.toLowerCase().includes(this.filterTag.trim().toLowerCase())
                    ))
              );
              return html` <div class="tickets">
                ${visibleTickets.map((t) => this.renderTicket(t))}
              </div>`;
            })()}
          `}
    `;
  }

  private renderTicket(t: TicketData) {
    return html`
      <div class="ticket">
        <div class="ticket-header" style="display: flex; gap: 8px; align-items: center;">
          <span class="ticket-id">${t.id.slice(0, 8)}</span>
          <span class="badge ${t.status}">${t.status}</span>
          ${t.assignee
            ? html`<span class="badge"
                style="background: var(--bg-input); color: var(--text-dim)"
              >→ ${t.assignee}</span>`
            : nothing}
          <span style="color: var(--text-dim); font-size: 12px;">${this.getRelativeTime(t.created_at)}</span>
        </div>
        <div class="ticket-objective">${t.objective}</div>
        
        <div style="display: flex; gap: 8px; align-items: center;">
          ${t.tags && t.tags.length > 0
            ? html`
                <div class="tags" style="display: flex; gap: 4px; flex-wrap: wrap;">
                  ${t.tags.map((tag) => html`<span class="badge" style="background: var(--bg-input); color: var(--text-dim)">#${tag}</span>`)}
                </div>
              `
            : html`<span style="color: var(--text-dim); font-size: 12px;">(no tags)</span>`}
          
          <button 
            @click=${() => {
              this.editingTagsId = t.id;
              this.editedTagsText = t.tags ? t.tags.join(", ") : "";
            }}
            style="padding: 2px 6px; font-size: 11px; background: var(--bg-input); color: var(--text-dim); border: 1px solid var(--border); border-radius: 4px; cursor: pointer;"
          >Edit</button>
        </div>

        ${this.editingTagsId === t.id
          ? html`
              <div class="floating-edit" style="margin-top: 8px; padding: 8px; background: var(--bg-input); border-radius: 6px; border: 1px solid var(--border);">
                <input
                  type="text"
                  placeholder="Tags (comma separated)..."
                  .value=${this.editedTagsText}
                  @input=${(e: Event) => (this.editedTagsText = (e.target as HTMLInputElement).value)}
                  style="width: 100%; padding: 4px; background: var(--bg); color: var(--text); border: none; border-radius: 4px;"
                />
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                  <button @click=${() => (this.editingTagsId = "")} style="font-size: 12px; padding: 4px 8px; background: transparent; color: var(--text-dim); border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">Cancel</button>
                  <button @click=${() => this.saveEditedTags(t.id)} style="font-size: 12px; padding: 4px 8px; background: var(--bg-input); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-weight: bold;">Save</button>
                </div>
              </div>
            `
          : nothing}

        ${t.depends_on?.length
          ? html`<div class="ticket-deps">
              depends on: ${t.depends_on.map(
                (d) => html`<code>${d.slice(0, 8)}</code> `
              )}
            </div>`
          : nothing}
        ${t.status === "suspended" && t.assignee === "user"
          ? this.renderRespond(t)
          : nothing}
        
        ${t.events_log?.length
          ? html`<div class="ticket-logs" style="font-family: monospace; font-size: 0.85rem; background: var(--bg-input); padding: 8px; border-radius: 4px; max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
              ${t.events_log.map((e) => this.renderLogEvent(e))}
            </div>`
          : nothing}

        ${t.outcome
          ? html`<div class="ticket-outcome">${t.outcome}</div>`
          : nothing}
        ${t.error
          ? html`<div class="ticket-error">${t.error}</div>`
          : nothing}
        ${t.turns || t.thoughts
          ? html`<div class="metrics">
              ${t.turns ? html`<span>${t.turns} turns</span>` : nothing}
              ${t.thoughts
                ? html`<span>${t.thoughts} thoughts</span>`
                : nothing}
            </div>`
          : nothing}
      </div>
    `;
  }

  private renderRespond(t: TicketData) {
    const prompt = this.extractPrompt(t);
    return html`
      <div class="respond-prompt">🤖 ${prompt}</div>
      <div class="respond-form">
        <input
          type="text"
          placeholder="Your response..."
          .value=${this.responses[t.id] ?? ""}
          @input=${(e: Event) => {
            this.responses = {
              ...this.responses,
              [t.id]: (e.target as HTMLInputElement).value,
            };
          }}
          @keydown=${(e: KeyboardEvent) => this.onRespondKeyDown(e, t.id)}
        />
        <button @click=${() => this.respond(t.id)}>Send</button>
      </div>
    `;
  }
  private renderLogEvent(e: Record<string, unknown>) {
    if ("thought" in e) {
      const thought = e.thought as Record<string, unknown>;
      return html`<span style="color: var(--text-dim)">💭 ${thought.text}</span>`;
    }
    if ("functionCall" in e) {
      const fc = e.functionCall as Record<string, unknown>;
      return html`<span style="color: var(--accent)">🔧 ${fc.name}</span>`;
    }
    if ("error" in e) {
      const err = e.error as Record<string, unknown>;
      return html`<span style="color: var(--red)">❌ ${err.message}</span>`;
    }
    if ("complete" in e) {
      const complete = e.complete as Record<string, unknown>;
      const result = complete.result as Record<string, unknown>;
      const success = result?.success;
      return html`<span>${success ? "✅" : "❌"} complete</span>`;
    }
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-app": BeesApp;
  }
}
