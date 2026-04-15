/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detail panel for the hive system configuration.
 *
 * Displays the SYSTEM.yaml fields (title, description, root, mcp) in
 * view mode, with inline editing via the editable primitives. Implements
 * the `EditablePanel` interface so `app.ts` can guard tab switches and
 * wire Cmd+S / Escape.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type {
  SystemStore,
  SystemData,
  MCPServerConfig,
} from "../data/system-store.js";
import type { TemplateStore } from "../data/template-store.js";
import { sharedStyles } from "./shared-styles.js";
import "./primitives/editable-field.js";
import "./primitives/editable-textarea.js";
import "./primitives/edit-controls.js";

export { BeesSystemDetail };

@customElement("bees-system-detail")
class BeesSystemDetail extends SignalWatcher(LitElement) {
  static styles = [
    sharedStyles,
    css`
      .system-badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: #7c3aed22;
        color: #a78bfa;
        border: 1px solid #7c3aed55;
      }

      .edit-btn {
        padding: 4px 10px;
        font-size: 0.7rem;
        background: transparent;
        color: #94a3b8;
        border: 1px solid #334155;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }

      .edit-btn:hover {
        color: #e2e8f0;
        border-color: #3b82f6;
        background: #1e293b;
      }

      .edit-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .edit-controls-bar {
        position: sticky;
        top: 0;
        z-index: 11;
        padding: 8px 0;
        background: #0b0c0f;
        border-bottom: 1px solid #1e293b;
      }

      .error-banner {
        padding: 8px 12px;
        background: #450a0a;
        border: 1px solid #991b1b;
        border-radius: 6px;
        color: #fca5a5;
        font-size: 0.8rem;
      }

      .root-link {
        cursor: pointer;
        transition: color 0.15s;
      }

      .root-link:hover {
        color: #93c5fd;
      }

      /* MCP server cards */
      .mcp-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .mcp-card {
        background: #111318;
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
      }

      .mcp-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .mcp-name {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.85rem;
        font-weight: 600;
        color: #a78bfa;
      }

      .mcp-transport {
        font-size: 0.6rem;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .mcp-transport.http {
        background: #164e6322;
        color: #38bdf8;
        border: 1px solid #164e6355;
      }

      .mcp-transport.stdio {
        background: #166534aa;
        color: #86efac;
        border: 1px solid #16653455;
      }

      .mcp-url,
      .mcp-command {
        font-family: "Google Mono", "Roboto Mono", monospace;
        font-size: 0.75rem;
        color: #94a3b8;
        word-break: break-all;
      }

      .mcp-desc {
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 4px;
      }

      .kv-table {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2px 12px;
        font-size: 0.7rem;
        font-family: "Google Mono", "Roboto Mono", monospace;
        margin-top: 6px;
      }

      .kv-key {
        color: #64748b;
      }

      .kv-value {
        color: #94a3b8;
        word-break: break-all;
      }

      /* MCP edit mode */
      .mcp-edit-card {
        background: #0f1115;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        position: relative;
      }

      .mcp-edit-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .mcp-edit-fields {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .mcp-edit-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .remove-server-btn,
      .add-server-btn {
        padding: 4px 10px;
        font-size: 0.7rem;
        background: transparent;
        border: 1px solid #334155;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }

      .remove-server-btn {
        color: #f87171;
        border-color: #991b1b55;
      }

      .remove-server-btn:hover {
        background: #450a0a;
        border-color: #991b1b;
      }

      .add-server-btn {
        color: #a78bfa;
        border-color: #7c3aed55;
        align-self: flex-start;
      }

      .add-server-btn:hover {
        background: #1e1338;
        border-color: #7c3aed;
      }

      .kv-edit-table {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .kv-edit-row {
        display: grid;
        grid-template-columns: 1fr 2fr auto;
        gap: 6px;
        align-items: center;
      }

      .kv-edit-row input {
        padding: 4px 8px;
        background: #0b0c0f;
        border: 1px solid #334155;
        color: #e2e8f0;
        border-radius: 4px;
        font-size: 0.7rem;
        font-family: "Google Mono", "Roboto Mono", monospace;
        transition: border-color 0.15s;
      }

      .kv-edit-row input:focus {
        outline: none;
        border-color: #3b82f6;
      }

      .kv-remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        font-size: 0.6rem;
        color: #64748b;
        cursor: pointer;
        border-radius: 50%;
        transition: color 0.15s, background 0.15s;
      }

      .kv-remove:hover {
        color: #f87171;
        background: #991b1b33;
      }

      .kv-add-btn {
        padding: 2px 8px;
        font-size: 0.65rem;
        background: transparent;
        color: #64748b;
        border: 1px dashed #334155;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
        align-self: flex-start;
        margin-top: 4px;
      }

      .kv-add-btn:hover {
        color: #94a3b8;
        border-color: #64748b;
      }

      .kv-label {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin-bottom: 4px;
      }

      .transport-toggle {
        display: flex;
        gap: 0;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid #334155;
        align-self: flex-start;
      }

      .transport-toggle button {
        padding: 4px 14px;
        font-size: 0.7rem;
        font-family: inherit;
        font-weight: 600;
        background: transparent;
        color: #64748b;
        border: none;
        cursor: pointer;
        transition: all 0.15s;
        letter-spacing: 0.03em;
      }

      .transport-toggle button.active {
        color: #e2e8f0;
      }

      .transport-toggle button.active.http {
        background: #164e6333;
        color: #38bdf8;
      }

      .transport-toggle button.active.local {
        background: #16653422;
        color: #86efac;
      }
    `,
  ];

  @property({ attribute: false })
  accessor systemStore: SystemStore | null = null;

  @property({ attribute: false })
  accessor templateStore: TemplateStore | null = null;

  // ── Edit state ──
  @state() accessor editing = false;
  @state() accessor saving = false;
  @state() accessor error: string | null = null;
  @state() accessor draft: SystemData | null = null;

  #original: SystemData | null = null;

  render() {
    if (!this.systemStore) return nothing;

    const config = this.systemStore.config.get();

    if (this.editing && this.draft) {
      return this.renderEditMode(this.draft);
    }

    return this.renderViewMode(config);
  }

  // ── View Mode ──

  private renderViewMode(config: SystemData) {
    const rootExists =
      this.templateStore
        ?.templates.get()
        .some((t) => t.name === config.root) ?? false;

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">${config.title || "Untitled Hive"}</h2>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="edit-btn" @click=${() => this.startEditing(config)}>
                ✏️ Edit
              </button>
              <div class="system-badge">SYSTEM</div>
            </div>
          </div>
          ${config.description
            ? html`<div class="job-detail-meta">
                <span>${config.description}</span>
              </div>`
            : nothing}
        </div>

        <div class="timeline">
          <div class="identity-row">
            <span class="identity-chip playbook">
              <span class="identity-label">title</span>
              ${config.title || "—"}
            </span>
          </div>

          <div class="block">
            <div class="block-header">Description</div>
            <div class="block-content">
              ${config.description || html`<span style="color:#475569;font-style:italic">No description</span>`}
            </div>
          </div>

          <div class="block">
            <div class="block-header">Root Template</div>
            <div class="block-content">
              <span
                class="identity-chip playbook ${rootExists ? "linkable" : ""}"
                @click=${rootExists
                  ? () => this.navigateToTemplate(config.root)
                  : nothing}
              >
                <span class="identity-label">root</span>
                ${config.root || "—"}
              </span>
              ${config.root && !rootExists
                ? html`<span style="color:#f59e0b;font-size:0.75rem;margin-left:8px">
                    ⚠ template not found
                  </span>`
                : nothing}
            </div>
          </div>

          ${this.renderMCPViewSection(config.mcp)}
        </div>
      </div>
    `;
  }

  // ── MCP View Section ──

  private renderMCPViewSection(servers: MCPServerConfig[]) {
    return html`
      <div class="block">
        <div class="block-header">MCP Servers</div>
        <div class="block-content">
          ${servers.length === 0
            ? html`<span style="color:#475569;font-style:italic">
                No MCP servers registered
              </span>`
            : servers.map((server) => this.renderMCPViewCard(server))}
        </div>
      </div>
    `;
  }

  private renderMCPViewCard(server: MCPServerConfig) {
    const isHttp = !!server.url;
    const kvEntries = server.headers
      ? Object.entries(server.headers)
      : server.env
        ? Object.entries(server.env)
        : [];
    const kvLabel = server.headers ? "headers" : server.env ? "env" : "";

    return html`
      <div class="mcp-card">
        <div class="mcp-card-header">
          <span class="mcp-name">${server.name}</span>
          <span class="mcp-transport ${isHttp ? "http" : "stdio"}">
            ${isHttp ? "HTTP" : "stdio"}
          </span>
        </div>
        ${server.description
          ? html`<div class="mcp-desc">${server.description}</div>`
          : nothing}
        ${server.url
          ? html`<div class="mcp-url">${server.url}</div>`
          : nothing}
        ${server.command
          ? html`<div class="mcp-command">${server.command}</div>`
          : nothing}
        ${kvEntries.length > 0
          ? html`
              <div class="kv-table">
                ${kvEntries.map(
                  ([key, value]) => html`
                    <span class="kv-key">${key}:</span>
                    <span class="kv-value">${value}</span>
                  `
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ── Edit Mode ──

  private renderEditMode(draft: SystemData) {
    const isDirty = this.isDirty();
    const templateNames = (this.templateStore?.templates.get() ?? []).map(
      (t) => t.name
    );

    return html`
      <div class="job-detail">
        <div class="job-detail-header">
          <div class="job-detail-header-top">
            <h2 class="job-detail-title">
              Editing: System Configuration
            </h2>
            <div class="system-badge">EDITING</div>
          </div>
        </div>

        <div class="timeline">
          <div class="edit-controls-bar">
            <bees-edit-controls
              ?dirty=${isDirty}
              ?saving=${this.saving}
              @save=${() => this.handleSave()}
              @cancel=${() => this.cancelEditing()}
            ></bees-edit-controls>
          </div>

          ${this.error
            ? html`<div class="error-banner">${this.error}</div>`
            : nothing}

          <div class="edit-form">
            <bees-editable-field
              label="Title"
              .value=${draft.title}
              editing
              placeholder="Hive display name"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ title: e.detail.value })}
            ></bees-editable-field>

            <bees-editable-textarea
              label="Description"
              .value=${draft.description}
              editing
              min-height="60"
              placeholder="Short summary shown in UI"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ description: e.detail.value })}
            ></bees-editable-textarea>

            <bees-editable-field
              label="Root Template"
              .value=${draft.root}
              editing
              placeholder="Template name to auto-boot at startup"
              @change=${(e: CustomEvent) =>
                this.updateDraft({ root: e.detail.value })}
            ></bees-editable-field>

            ${templateNames.length > 0
              ? html`
                  <div style="font-size:0.75rem;color:#64748b">
                    Available templates:
                    ${templateNames.map(
                      (name) => html`
                        <span
                          class="identity-chip playbook linkable"
                          style="font-size:0.7rem;margin:2px"
                          @click=${() => this.updateDraft({ root: name })}
                        >${name}</span>
                      `
                    )}
                  </div>
                `
              : nothing}

            <!-- MCP Servers -->
            <div class="block">
              <div class="mcp-section-header">
                <div class="block-header">MCP Servers</div>
                <button
                  class="add-server-btn"
                  @click=${() => this.addMCPServer()}
                >
                  + Add Server
                </button>
              </div>
              ${draft.mcp.map((server, i) =>
                this.renderMCPEditCard(server, i)
              )}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── MCP Edit Card ──

  private renderMCPEditCard(server: MCPServerConfig, index: number) {
    const isHttp = server.command === undefined;

    return html`
      <div class="mcp-edit-card">
        <div class="mcp-edit-card-header">
          <span class="mcp-name">#${index + 1}</span>
          <button
            class="remove-server-btn"
            @click=${() => this.removeMCPServer(index)}
          >
            ✕ Remove
          </button>
        </div>

        <div class="mcp-edit-fields">
          <div class="mcp-edit-row">
            <bees-editable-field
              label="Name"
              .value=${server.name}
              editing
              placeholder="server-name"
              @change=${(e: CustomEvent) =>
                this.updateMCPServer(index, { name: e.detail.value })}
            ></bees-editable-field>

            <bees-editable-field
              label="Description"
              .value=${server.description ?? ""}
              editing
              placeholder="Optional description"
              @change=${(e: CustomEvent) =>
                this.updateMCPServer(index, {
                  description: e.detail.value || undefined,
                })}
            ></bees-editable-field>
          </div>

          <!-- Transport chooser -->
          <div class="transport-toggle">
            <button
              class="http ${isHttp ? "active" : ""}"
              @click=${() =>
                this.updateMCPServer(index, {
                  url: server.url ?? "",
                  command: undefined,
                  env: undefined,
                })}
            >HTTP</button>
            <button
              class="local ${!isHttp ? "active" : ""}"
              @click=${() =>
                this.updateMCPServer(index, {
                  command: server.command ?? "",
                  url: undefined,
                  headers: undefined,
                })}
            >Local</button>
          </div>

          ${isHttp
            ? html`
                <bees-editable-field
                  label="URL"
                  .value=${server.url ?? ""}
                  editing
                  placeholder="https://example.com/mcp"
                  @change=${(e: CustomEvent) =>
                    this.updateMCPServer(index, {
                      url: e.detail.value || undefined,
                    })}
                ></bees-editable-field>

                ${this.renderKVEditor(
                  "Headers",
                  server.headers ?? {},
                  (headers) => this.updateMCPServer(index, { headers })
                )}
              `
            : html`
                <bees-editable-field
                  label="Command"
                  .value=${server.command ?? ""}
                  editing
                  placeholder="npx -y @example/server"
                  @change=${(e: CustomEvent) =>
                    this.updateMCPServer(index, {
                      command: e.detail.value || undefined,
                    })}
                ></bees-editable-field>

                ${this.renderKVEditor(
                  "Environment Variables",
                  server.env ?? {},
                  (env) => this.updateMCPServer(index, { env })
                )}
              `}
        </div>
      </div>
    `;
  }

  // ── Key-Value Editor ──

  private renderKVEditor(
    label: string,
    entries: Record<string, string>,
    onChange: (updated: Record<string, string>) => void
  ) {
    const pairs = Object.entries(entries);

    return html`
      <div>
        <div class="kv-label">${label}</div>
        <div class="kv-edit-table">
          ${pairs.map(
            ([key, value], i) => html`
              <div class="kv-edit-row">
                <input
                  .value=${key}
                  placeholder="key"
                  @input=${(e: InputEvent) => {
                    const newKey = (e.currentTarget as HTMLInputElement).value;
                    const updated = { ...entries };
                    delete updated[key];
                    updated[newKey] = value;
                    onChange(updated);
                  }}
                />
                <input
                  .value=${value}
                  placeholder="value"
                  @input=${(e: InputEvent) => {
                    const newVal = (e.currentTarget as HTMLInputElement).value;
                    const updated = { ...entries, [key]: newVal };
                    onChange(updated);
                  }}
                />
                <span
                  class="kv-remove"
                  @click=${() => {
                    const updated = { ...entries };
                    delete updated[key];
                    onChange(updated);
                  }}
                  title="Remove"
                >✕</span>
              </div>
            `
          )}
          <button
            class="kv-add-btn"
            @click=${() => {
              const updated = { ...entries, "": "" };
              onChange(updated);
            }}
          >
            + Add
          </button>
        </div>
      </div>
    `;
  }

  // ── Edit actions ──

  private startEditing(config: SystemData) {
    this.#original = structuredClone(config);
    this.draft = structuredClone(config);
    this.editing = true;
    this.error = null;
  }

  /** Whether the component is currently in edit mode. */
  get isEditing(): boolean {
    return this.editing;
  }

  /** Whether there are unsaved changes. */
  get hasDirtyEdits(): boolean {
    return this.editing && this.isDirty();
  }

  /** Programmatically trigger a save (e.g. from Cmd+S). */
  triggerSave() {
    if (this.editing && this.isDirty()) this.handleSave();
  }

  cancelEditing() {
    this.editing = false;
    this.draft = null;
    this.#original = null;
    this.error = null;
  }

  private updateDraft(partial: Partial<SystemData>) {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...partial };
  }

  private addMCPServer() {
    if (!this.draft) return;
    this.draft = {
      ...this.draft,
      mcp: [...this.draft.mcp, { name: "" }],
    };
  }

  private removeMCPServer(index: number) {
    if (!this.draft) return;
    this.draft = {
      ...this.draft,
      mcp: this.draft.mcp.filter((_, i) => i !== index),
    };
  }

  private updateMCPServer(index: number, partial: Partial<MCPServerConfig>) {
    if (!this.draft) return;
    const mcp = [...this.draft.mcp];
    mcp[index] = { ...mcp[index], ...partial };
    this.draft = { ...this.draft, mcp };
  }

  private isDirty(): boolean {
    if (!this.draft || !this.#original) return false;
    return JSON.stringify(this.#original) !== JSON.stringify(this.draft);
  }

  private async handleSave() {
    if (!this.draft || !this.systemStore) return;

    if (!this.draft.title.trim()) {
      this.error = "Title is required.";
      return;
    }
    if (!this.draft.root.trim()) {
      this.error = "Root template is required.";
      return;
    }

    // Validate MCP servers.
    for (const server of this.draft.mcp) {
      if (!server.name.trim()) {
        this.error = "Each MCP server must have a name.";
        return;
      }
      if (!server.url && !server.command) {
        this.error = `MCP server "${server.name}" needs either a URL or command.`;
        return;
      }
    }

    this.saving = true;
    this.error = null;

    try {
      await this.systemStore.save(this.draft);

      // Flash "Saved ✓".
      const controls = this.shadowRoot?.querySelector("bees-edit-controls");
      if (controls) (controls as { flashSaved(): void }).flashSaved();

      this.#original = structuredClone(this.draft);
      this.editing = false;
      this.draft = null;
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Save failed. Check console.";
      console.error("System config save error:", e);
    } finally {
      this.saving = false;
    }
  }

  // ── Navigation ──

  private navigateToTemplate(name: string) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { tab: "templates", id: name },
        bubbles: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-system-detail": BeesSystemDetail;
  }
}
