/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";

import { BeesAPI } from "../data/api.js";
import { BeesConnection } from "../data/connection.js";
import { BeesState } from "../data/state.js";
import type { TicketData, PlaybookData } from "../data/types.js";
import {
  getRelativeTime,
  extractPrompt,
  extractChoices,
  parseTags,
} from "../utils.js";
import { APP_NAME, APP_ICON } from "../constants.js";
import { MessageBridge } from "../host/message-bridge.js";
import { styles } from "./app.styles.js";

export { BeesApp };

const appState = new BeesState();

type ActiveTab = "playbooks" | "tickets";

@customElement("bees-app")
class BeesApp extends SignalWatcher(LitElement) {
  @state()
  private activeTab: ActiveTab = "playbooks";

  @state()
  private objective = "";

  @state()
  private tagsText = "";

  @state()
  private functionsText = "";

  @state()
  private skillsText = "";

  @state()
  private filterTag = "";

  @state()
  private editingTagsId = "";

  @state()
  private editedTagsText = "";

  @state()
  private responses: Record<string, string> = {};

  @state()
  private selectedChoices: Record<string, string[]> = {};

  @state()
  private playbooks: PlaybookData[] = [];

  @state()
  private contextExpanded: Record<string, boolean> = {};

  @state()
  private contextPlaybookId: Record<string, string> = {};

  @state()
  private contextUpdate: Record<string, string> = {};

  @state()
  private loadingPlaybooks = false;

  private connection = new BeesConnection(appState);
  private api = new BeesAPI();

  static styles = [styles];

  connectedCallback() {
    super.connectedCallback();
    this.connection.connect();
    this.loadPlaybooks();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.connection.close();
  }

  render() {
    return html`
      ${this.renderHeader()} ${this.renderTabs()} ${this.renderFilter()}
      ${this.renderTicketList()}
    `;
  }

  private renderHeader() {
    return html`
      <header class="header">
        <div class="header-left">
          <div
            class="status-dot ${appState.draining.get() ? "draining" : ""}"
          ></div>
          <h1>${APP_ICON} <span>${APP_NAME}</span></h1>
        </div>
      </header>
    `;
  }

  private renderTabs() {
    return html`
      <div class="tab-container">
        <div class="tab-bar">
          <button
            class="tab ${this.activeTab === "playbooks" ? "active" : ""}"
            @click=${() => (this.activeTab = "playbooks")}
          >
            Run Playbooks
          </button>
          <button
            class="tab ${this.activeTab === "tickets" ? "active" : ""}"
            @click=${() => (this.activeTab = "tickets")}
          >
            Create Tickets
          </button>
        </div>
        <div class="tab-content">
          ${this.activeTab === "playbooks"
            ? this.renderPlaybooksTab()
            : this.renderAddForm()}
        </div>
      </div>
    `;
  }

  private renderPlaybooksTab() {
    if (this.loadingPlaybooks) {
      return html`<div class="playbooks-loading">Loading playbooks…</div>`;
    }

    if (this.playbooks.length === 0) {
      return html`<div class="playbooks-empty">
        No playbooks found. Add YAML files to <code>playbooks/</code>.
      </div>`;
    }

    return html`
      <div class="playbooks-list">
        ${this.playbooks.map(
          (p) => html`
            <div class="playbook-card">
              <div class="playbook-info">
                <span class="playbook-title">${p.title}</span>
                <span class="playbook-desc">${p.description}</span>
              </div>
              <button
                class="playbook-run-btn"
                @click=${() => this.runPlaybook(p.name)}
              >
                Run
              </button>
            </div>
          `
        )}
      </div>
    `;
  }

  private renderAddForm() {
    return html`
      <div class="add-form">
        <textarea
          class="objective-input"
          placeholder="Enter objective... (use {{id}} for deps)"
          .value=${this.objective}
          @input=${(e: Event) =>
            (this.objective = (e.target as HTMLTextAreaElement).value)}
          @keydown=${this.onTextareaKeyDown}
          rows="2"
        ></textarea>
        <div class="add-form-row">
          <input
            class="meta-input"
            type="text"
            placeholder="Tags"
            .value=${this.tagsText}
            @input=${(e: Event) =>
              (this.tagsText = (e.target as HTMLInputElement).value)}
            @keydown=${this.onKeyDown}
          />
          <input
            class="meta-input"
            type="text"
            placeholder="Functions"
            .value=${this.functionsText}
            @input=${(e: Event) =>
              (this.functionsText = (e.target as HTMLInputElement).value)}
            @keydown=${this.onKeyDown}
          />
          <input
            class="meta-input"
            type="text"
            placeholder="Skills"
            .value=${this.skillsText}
            @input=${(e: Event) =>
              (this.skillsText = (e.target as HTMLInputElement).value)}
            @keydown=${this.onKeyDown}
          />
          <button @click=${this.addTicket} ?disabled=${!this.objective.trim()}>
            Add Ticket
          </button>
        </div>
      </div>
    `;
  }

  private renderFilter() {
    return html`
      <input
        class="filter-input"
        type="text"
        placeholder="Filter by tag..."
        .value=${this.filterTag}
        @input=${(e: Event) =>
          (this.filterTag = (e.target as HTMLInputElement).value)}
      />
    `;
  }

  private renderTicketList() {
    if (appState.tickets.get().length === 0) {
      return html`<div class="empty">No tickets yet. Add one above.</div>`;
    }

    const filter = this.filterTag.trim().toLowerCase();
    const visible = filter
      ? appState.tickets
          .get()
          .filter(
            (t) =>
              t.tags && t.tags.some((tag) => tag.toLowerCase().includes(filter))
          )
      : appState.tickets.get();

    return html`
      <div class="tickets">${visible.map((t) => this.renderTicket(t))}</div>
    `;
  }

  private renderTicket(t: TicketData) {
    return html`
      <div class="ticket">
        <div class="ticket-header">
          <span class="ticket-id">${t.id.slice(0, 8)}</span>
          <span class="badge ${t.status}">${t.status}</span>
          ${t.kind === "coordination"
            ? html`<span class="badge coordination">coordination</span>`
            : nothing}
          ${t.assignee
            ? html`<span class="badge muted">→ ${t.assignee}</span>`
            : nothing}
          <span class="ticket-time"> ${getRelativeTime(t.created_at)} </span>
        </div>

        ${t.kind === "coordination"
          ? html`
              <div class="ticket-signal">
                <code class="signal-type">${t.signal_type}</code>
                ${t.context
                  ? html`<span class="signal-context">${t.context}</span>`
                  : nothing}
              </div>
            `
          : html`<div class="ticket-objective">${t.objective}</div>`}

        <div class="ticket-tags">
          ${t.tags && t.tags.length > 0
            ? html`
                <div class="tags-list">
                  ${t.tags.map(
                    (tag) => html`<span class="badge muted">#${tag}</span>`
                  )}
                </div>
              `
            : html`<span class="no-tags">(no tags)</span>`}
          <button
            class="btn-edit"
            @click=${() => {
              this.editingTagsId = t.id;
              this.editedTagsText = t.tags ? t.tags.join(", ") : "";
            }}
          >
            Edit
          </button>
        </div>

        ${this.editingTagsId === t.id ? this.renderTagEditor(t) : nothing}
        ${t.functions?.length
          ? html`<div class="ticket-functions">
              functions: ${t.functions.map((f) => html`<code>${f}</code> `)}
            </div>`
          : nothing}
        ${t.skills?.length
          ? html`<div class="ticket-functions">
              skills: ${t.skills.map((s) => html`<code>${s}</code> `)}
            </div>`
          : nothing}
        ${t.depends_on?.length
          ? html`<div class="ticket-deps">
              depends on:
              ${t.depends_on.map((d) => html`<code>${d.slice(0, 8)}</code> `)}
            </div>`
          : nothing}
        ${t.status === "suspended" && t.assignee === "user"
          ? this.renderRespond(t)
          : nothing}
        ${!((t.status === "completed" || t.status === "suspended") && t.tags && t.tags.includes("bundle")) &&
        t.events_log?.length
          ? html`<div class="ticket-logs">
              ${t.events_log.map((e) => this.renderLogEvent(e))}
            </div>`
          : nothing}
        ${!((t.status === "completed" || t.status === "suspended") && t.tags && t.tags.includes("bundle")) &&
        t.outcome
          ? html`<div class="ticket-outcome">${t.outcome}</div>`
          : nothing}
        ${t.error ? html`<div class="ticket-error">${t.error}</div>` : nothing}
        ${t.turns || t.thoughts
          ? html`<div class="metrics">
              ${t.turns ? html`<span>${t.turns} turns</span>` : nothing}
              ${t.thoughts
                ? html`<span>${t.thoughts} thoughts</span>`
                : nothing}
            </div>`
          : nothing}
        ${(t.status === "completed" || t.status === "suspended") && t.tags && t.tags.includes("bundle")
          ? this.renderApp(t)
          : nothing}
      </div>
    `;
  }

  private renderApp(t: TicketData) {
    return html`
      <div class="ticket-app-container">
        <iframe
          class="ticket-app-frame"
          src="/iframe.html"
          @load=${(e: Event) =>
            this.initApp(t.id, e.target as HTMLIFrameElement)}
        ></iframe>
      </div>
    `;
  }

  private async initApp(ticketId: string, iframe: HTMLIFrameElement) {
    try {
      const [jsRes, cssRes] = await Promise.all([
        fetch(`/tickets/${ticketId}/files/bundle.js`),
        fetch(`/tickets/${ticketId}/files/bundle.css`),
      ]);
      const code = jsRes.ok ? await jsRes.text() : "";
      let css = cssRes.ok ? await cssRes.text() : undefined;
      if (!cssRes.ok) css = undefined;

      const bridge = new MessageBridge(iframe);
      bridge.onMessage((msg) => {
        if (msg.type === "emit") {
          console.log("App emitted:", msg.event, msg.payload);
        }
        if (msg.type === "error") {
          console.error("App error:", msg.message, msg.stack);
        }
      });

      await bridge.send({
        type: "render",
        code,
        css,
        props: {},
        assets: {},
      });
    } catch (err) {
      console.error("Failed to init app:", err);
    }
  }

  private renderTagEditor(t: TicketData) {
    return html`
      <div class="tag-editor">
        <input
          type="text"
          placeholder="Tags (comma separated)..."
          .value=${this.editedTagsText}
          @input=${(e: Event) =>
            (this.editedTagsText = (e.target as HTMLInputElement).value)}
        />
        <div class="tag-editor-actions">
          <button class="btn-cancel" @click=${() => (this.editingTagsId = "")}>
            Cancel
          </button>
          <button class="btn-save" @click=${() => this.saveEditedTags(t.id)}>
            Save
          </button>
        </div>
      </div>
    `;
  }

  private renderRespond(t: TicketData) {
    const prompt = extractPrompt(t);
    const choices = extractChoices(t);
    const selectionMode =
      ((t.suspend_event?.waitForChoice as Record<string, unknown>)
        ?.selectionMode as string) ?? "single";

    if (choices.length > 0) {
      return html`
        <div class="respond-prompt">🤖 ${prompt}</div>
        <div
          class="respond-form choices ${selectionMode === "multiple"
            ? "multiple"
            : "single"}"
        >
          <div class="choices-list">
            ${choices.map(
              (c) => html`
                <label class="choice-label">
                  <input
                    type="${selectionMode === "multiple"
                      ? "checkbox"
                      : "radio"}"
                    name="choice-${t.id}"
                    .checked=${this.selectedChoices[t.id]?.includes(c.id) ??
                    false}
                    @change=${(e: Event) =>
                      this.handleChoiceChange(
                        t.id,
                        c.id,
                        selectionMode === "multiple",
                        (e.target as HTMLInputElement).checked
                      )}
                  />
                  <span>${c.text}</span>
                </label>
              `
            )}
          </div>
          <button @click=${() => this.respondWithChoices(t.id)}>
            Send Selection
          </button>
        </div>
        ${this.renderContextUpdates(t.id)}
      `;
    }

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
      ${this.renderContextUpdates(t.id)}
    `;
  }

  private renderLogEvent(e: Record<string, unknown>) {
    if ("thought" in e) {
      const thought = e.thought as Record<string, unknown>;
      return html`<span class="log-thought">💭 ${thought.text}</span>`;
    }
    if ("functionCall" in e) {
      const fc = e.functionCall as Record<string, unknown>;
      return html`<span class="log-tool">🔧 ${fc.name}</span>`;
    }
    if ("error" in e) {
      const err = e.error as Record<string, unknown>;
      return html`<span class="log-error">❌ ${err.message}</span>`;
    }
    if ("complete" in e) {
      const complete = e.complete as Record<string, unknown>;
      const result = complete.result as Record<string, unknown>;
      const success = result?.success;
      return html`<span>${success ? "✅" : "❌"} complete</span>`;
    }
    return nothing;
  }

  private async loadPlaybooks() {
    this.loadingPlaybooks = true;
    this.playbooks = await this.api.listPlaybooks();
    this.loadingPlaybooks = false;
  }

  private async runPlaybook(name: string) {
    await this.api.runPlaybook(name);
  }

  private async addTicket() {
    const text = this.objective.trim();
    if (!text) return;
    const tags = parseTags(this.tagsText);
    const apiFunctions = parseTags(this.functionsText);
    const skills = parseTags(this.skillsText);

    this.objective = "";
    this.tagsText = "";
    this.functionsText = "";
    this.skillsText = "";

    await this.api.addTicket(text, tags, apiFunctions, skills);
  }

  private async saveEditedTags(ticketId: string) {
    const tags = parseTags(this.editedTagsText);
    const ok = await this.api.updateTags(ticketId, tags);
    if (ok) {
      this.editingTagsId = "";
    }
  }

  private handleChoiceChange(
    ticketId: string,
    choiceId: string,
    isMultiple: boolean,
    checked: boolean
  ) {
    const current = this.selectedChoices[ticketId] ?? [];
    if (isMultiple) {
      if (checked) {
        this.selectedChoices = {
          ...this.selectedChoices,
          [ticketId]: [...current, choiceId],
        };
      } else {
        this.selectedChoices = {
          ...this.selectedChoices,
          [ticketId]: current.filter((id) => id !== choiceId),
        };
      }
    } else {
      this.selectedChoices = {
        ...this.selectedChoices,
        [ticketId]: [choiceId],
      };
    }
  }

  private async respondWithChoices(ticketId: string) {
    const selectedIds = this.selectedChoices[ticketId] ?? [];
    const contextUpdates = this.buildContextUpdates(ticketId);
    if (selectedIds.length === 0 && !contextUpdates) return;

    this.selectedChoices = { ...this.selectedChoices, [ticketId]: [] };
    await this.api.respond(
      ticketId, undefined,
      selectedIds.length > 0 ? selectedIds : undefined,
      contextUpdates,
    );
    this.clearContextFields(ticketId);
  }

  private async respond(ticketId: string) {
    const text = this.responses[ticketId]?.trim();
    const contextUpdates = this.buildContextUpdates(ticketId);
    if (!text && !contextUpdates) return;

    this.responses = { ...this.responses, [ticketId]: "" };
    await this.api.respond(ticketId, text || undefined, undefined, contextUpdates);
    this.clearContextFields(ticketId);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") this.addTicket();
  }

  private onTextareaKeyDown(e: KeyboardEvent) {
    // Cmd/Ctrl+Enter submits, plain Enter adds newline.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.addTicket();
    }
  }

  private onRespondKeyDown(e: KeyboardEvent, ticketId: string) {
    if (e.key === "Enter") this.respond(ticketId);
  }

  private renderContextUpdates(ticketId: string) {
    const expanded = this.contextExpanded[ticketId] ?? false;

    return html`
      <div class="context-updates">
        <button
          class="context-toggle"
          @click=${() => {
            this.contextExpanded = {
              ...this.contextExpanded,
              [ticketId]: !expanded,
            };
          }}
        >
          ${expanded ? "▾" : "▸"} Context Updates
        </button>
        ${expanded
          ? html`
              <div class="context-fields">
                <input
                  type="text"
                  placeholder="Playbook ID"
                  .value=${this.contextPlaybookId[ticketId] ?? ""}
                  @input=${(e: Event) => {
                    this.contextPlaybookId = {
                      ...this.contextPlaybookId,
                      [ticketId]: (e.target as HTMLInputElement).value,
                    };
                  }}
                />
                <textarea
                  placeholder="Update text..."
                  rows="3"
                  .value=${this.contextUpdate[ticketId] ?? ""}
                  @input=${(e: Event) => {
                    this.contextUpdate = {
                      ...this.contextUpdate,
                      [ticketId]: (e.target as HTMLTextAreaElement).value,
                    };
                  }}
                ></textarea>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private buildContextUpdates(ticketId: string): string[] | undefined {
    const playbookId = this.contextPlaybookId[ticketId]?.trim();
    const update = this.contextUpdate[ticketId]?.trim();
    if (!playbookId && !update) return undefined;

    const notification =
      `[System Notification] Playbook "${playbookId || "unknown"}" update:\n${update || "(no details)"}`;
    return [notification];
  }

  private clearContextFields(ticketId: string) {
    this.contextExpanded = { ...this.contextExpanded, [ticketId]: false };
    this.contextPlaybookId = { ...this.contextPlaybookId, [ticketId]: "" };
    this.contextUpdate = { ...this.contextUpdate, [ticketId]: "" };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-app": BeesApp;
  }
}
