/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Root orchestrator for the Bees Hivetool devtools.
 *
 * Manages tab navigation, URL routing, store lifecycle, and composes
 * the extracted list/detail components for each tab.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { APP_ICON, APP_NAME } from "../constants.js";
import { LogStore } from "../data/log-store.js";
import { MutationClient } from "../data/mutation-client.js";
import { parseRoute, writeRoute } from "../data/router.js";
import { StateAccess } from "../data/state-access.js";
import { SkillStore } from "../data/skill-store.js";
import { SystemStore } from "../data/system-store.js";
import { TicketStore } from "../data/ticket-store.js";
import { TemplateStore } from "../data/template-store.js";

// Import composed components (side-effect: registers custom elements).
import "./template-list.js";
import "./template-detail.js";
import "./skill-list.js";
import "./skill-detail.js";
import "./ticket-list.js";
import "./ticket-pane.js";
import "./event-list.js";
import "./event-detail.js";
import "./log-list.js";
import "./log-detail.js";
import "./system-detail.js";
import { scrollbarStyles } from "./shared-styles.js";

export { BeesApp };

type TabId = "logs" | "tickets" | "events" | "templates" | "skills" | "system";

/** Shared interface for editable detail panels. */
interface EditablePanel {
  readonly isEditing: boolean;
  readonly hasDirtyEdits: boolean;
  triggerSave(): void;
  cancelEditing(): void;
}

@customElement("bees-app")
class BeesApp extends SignalWatcher(LitElement) {
  @state() accessor activeTab: TabId = "tickets";
  @state() accessor selectedEventId: string | null = null;
  @state() accessor hivePickerOpen = false;

  private stateAccess = new StateAccess();
  private logStore = new LogStore(this.stateAccess);
  private ticketStore = new TicketStore(this.stateAccess);
  private templateStore = new TemplateStore(this.stateAccess);
  private skillStore = new SkillStore(this.stateAccess);
  private systemStore = new SystemStore(this.stateAccess);
  private mutationClient = new MutationClient(this.stateAccess);

  static styles = [
    scrollbarStyles,
    css`
      :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      margin: 0;
      padding: 0;
      background: #0f1115;
      color: #e2e8f0;
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
        sans-serif;
      overflow: hidden;
    }

    * {
      box-sizing: border-box;
    }

    /* --- Top bar (header + tabs) --- */
    .top-bar {
      background: #0f1115;
      border-bottom: 1px solid #1e293b;
      flex-shrink: 0;
      z-index: 20;
    }

    .top-bar-header {
      padding: 16px 20px 0 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .top-bar-header h1 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hive-switcher {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
    }

    .hive-name {
      font-size: 0.75rem;
      color: #94a3b8;
      font-family: "Google Mono", "Roboto Mono", monospace;
    }

    .hive-picker-btn {
      padding: 4px 10px;
      font-size: 0.7rem;
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hive-picker-btn:hover {
      color: #e2e8f0;
      border-color: #3b82f6;
      background: #1e293b;
    }

    .hive-picker-btn .chevron {
      font-size: 0.6rem;
      transition: transform 0.15s;
    }

    .hive-picker-btn .chevron.open {
      transform: rotate(180deg);
    }

    /* --- Hive picker popover --- */
    .hive-picker-popover {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 260px;
      background: #1a1e26;
      border: 1px solid #334155;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      z-index: 100;
      overflow: hidden;
    }

    .hive-picker-popover .picker-header {
      padding: 10px 12px 6px;
      font-size: 0.65rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .hive-picker-popover .picker-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .hive-picker-popover .picker-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: background 0.1s;
      font-size: 0.75rem;
      color: #cbd5e1;
    }

    .hive-picker-popover .picker-item:hover {
      background: #252a34;
    }

    .hive-picker-popover .picker-item.active {
      color: #f8fafc;
      background: #1e293b;
    }

    .hive-picker-popover .picker-item .indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .hive-picker-popover .picker-item.active .indicator {
      background: #3b82f6;
    }

    .hive-picker-popover .picker-item .item-name {
      flex: 1;
      font-family: "Google Mono", "Roboto Mono", monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hive-picker-popover .picker-item .remove-btn {
      padding: 0 4px;
      font-size: 0.7rem;
      color: #475569;
      background: none;
      border: none;
      cursor: pointer;
      border-radius: 3px;
      line-height: 1;
      opacity: 0;
      transition: all 0.1s;
    }

    .hive-picker-popover .picker-item:hover .remove-btn {
      opacity: 1;
    }

    .hive-picker-popover .picker-item .remove-btn:hover {
      color: #f87171;
      background: #991b1b33;
    }

    .hive-picker-popover .picker-divider {
      height: 1px;
      background: #334155;
      margin: 2px 0;
    }

    .hive-picker-popover .picker-action {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 0.75rem;
      color: #3b82f6;
      transition: background 0.1s;
    }

    .hive-picker-popover .picker-action:hover {
      background: #252a34;
    }

    .hive-picker-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99;
    }

    .top-bar-tabs {
      display: flex;
      padding: 0 20px;
    }

    .sidebar-tab {
      padding: 12px 10px;
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: color 0.15s;
      user-select: none;
    }

    .sidebar-tab.active {
      color: #f8fafc;
      border-bottom-color: #3b82f6;
    }

    .sidebar-tab:hover:not(.active) {
      color: #cbd5e1;
    }

    /* --- Content row --- */
    .content-row {
      display: flex;
      flex-direction: row;
      flex: 1;
      overflow: hidden;
    }

    .sidebar {
      width: 320px;
      background: #0f1115;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      height: 100%;
      flex-shrink: 0;
    }

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #0b0c0f;
      height: 100%;
      overflow-y: auto;
    }

    .empty-state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 0.9rem;
    }

    button {
      font-family: inherit;
      padding: 8px 16px;
      background: #3b82f6;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 0.85rem;
      cursor: pointer;
      transition: opacity 0.15s;
      white-space: nowrap;
    }

    button:hover {
      opacity: 0.9;
    }

    @keyframes lightning-flash {
      0% {
        background-color: rgba(96, 165, 250, 0.8);
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.6);
      }
      2% {
        background-color: rgba(96, 165, 250, 0.3);
        box-shadow: 0 0 10px rgba(96, 165, 250, 0.2);
      }
      100% {
        background-color: transparent;
        box-shadow: none;
      }
    }

    .lightning-flash {
      animation: lightning-flash 15s ease-out !important;
    }

    /* --- Hive control button --- */
    .hive-control-btn {
      padding: 4px 12px;
      font-size: 0.7rem;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
      white-space: nowrap;
    }

    .hive-control-btn.stop {
      background: transparent;
      color: #f87171;
      border: 1px solid #991b1b;
    }

    .hive-control-btn.stop:hover {
      background: #991b1b33;
      border-color: #f87171;
    }

    .hive-control-btn.resume {
      background: transparent;
      color: #4ade80;
      border: 1px solid #166534;
    }

    .hive-control-btn.resume:hover {
      background: #16653422;
      border-color: #4ade80;
    }

    .hive-control-btn.start {
      background: transparent;
      color: #475569;
      border: 1px solid #1e293b;
      cursor: default;
      opacity: 0.6;
    }
  `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.initStores();
    this.restoreRoute();
    window.addEventListener("popstate", this.onHashChange);
    window.addEventListener("keydown", this.#onKeyDown);
    window.addEventListener("beforeunload", this.#onBeforeUnload);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.logStore.destroy();
    this.ticketStore.destroy();
    window.removeEventListener("popstate", this.onHashChange);
    window.removeEventListener("keydown", this.#onKeyDown);
    window.removeEventListener("beforeunload", this.#onBeforeUnload);
  }

  // --- Store Initialization ---

  private async initStores(): Promise<void> {
    await this.stateAccess.init();
    if (this.stateAccess.accessState.get() !== "ready") return;
    await this.activateStores();
    this.restoreRoute();
  }

  private async activateStores(): Promise<void> {
    await Promise.all([
      this.logStore.activate(),
      this.ticketStore.activate(),
      this.templateStore.activate(),
      this.skillStore.activate(),
      this.systemStore.activate(),
    ]);
    this.mutationClient.startObserving();
  }

  private resetStores(): void {
    this.logStore.reset();
    this.ticketStore.reset();
    this.templateStore.reset();
    this.skillStore.reset();
    this.systemStore.reset();
    this.selectedEventId = null;
  }

  private async handleAddHive(): Promise<void> {
    this.resetStores();
    const added = await this.stateAccess.addHive();
    if (added && this.stateAccess.accessState.get() === "ready") {
      await this.activateStores();
      this.restoreRoute();
    }
    this.hivePickerOpen = false;
  }

  private async handleSwitchToHive(id: string): Promise<void> {
    if (id === this.stateAccess.activeHiveId.get()) {
      this.hivePickerOpen = false;
      return;
    }
    this.resetStores();
    await this.stateAccess.switchToHive(id);
    if (this.stateAccess.accessState.get() === "ready") {
      await this.activateStores();
      this.restoreRoute();
    }
    this.hivePickerOpen = false;
  }

  private async handleRemoveHive(id: string): Promise<void> {
    const entry = this.stateAccess.hives
      .get()
      .find((e) => e.id === id);
    const confirmed = confirm(
      `Remove "${entry?.name ?? id}" from remembered hives?`,
    );
    if (!confirmed) return;

    const wasActive = id === this.stateAccess.activeHiveId.get();
    if (wasActive) this.resetStores();

    await this.stateAccess.removeHive(id);

    if (wasActive && this.stateAccess.accessState.get() === "ready") {
      await this.activateStores();
      this.restoreRoute();
    }
  }

  private async handleRequestAccess(): Promise<void> {
    await this.stateAccess.requestAccess();
    if (this.stateAccess.accessState.get() === "ready") {
      await this.activateStores();
      this.restoreRoute();
    }
  }

  // --- Routing ---

  private syncHash(): void {
    let id: string | null | undefined;
    switch (this.activeTab) {
      case "logs":
        id = this.logStore.selectedSessionId.get();
        break;
      case "tickets":
        id = this.ticketStore.selectedTicketId.get();
        break;
      case "events":
        id = this.selectedEventId;
        break;
      case "templates":
        id = this.templateStore.selectedTemplateName.get();
        break;
      case "skills":
        id = this.skillStore.selectedSkillDir.get();
        break;
    }
    writeRoute(this.activeTab, id);
  }

  private async restoreRoute(): Promise<void> {
    const route = parseRoute();
    const validTabs: TabId[] = [
      "logs",
      "tickets",
      "events",
      "templates",
      "skills",
      "system",
    ];
    const tab = validTabs.includes(route.tab as TabId)
      ? (route.tab as TabId)
      : "tickets";
    this.activeTab = tab;

    if (this.stateAccess.accessState.get() !== "ready") return;

    switch (tab) {
      case "logs":
        if (route.id) this.logStore.selectSession(route.id);
        break;
      case "tickets":
        if (route.id) this.ticketStore.selectTicket(route.id);
        break;
      case "events":
        if (route.id) this.selectedEventId = route.id;
        break;
      case "templates":
        if (route.id) this.templateStore.selectTemplate(route.id);
        break;
      case "skills":
        if (route.id) this.skillStore.selectSkill(route.id);
        break;
    }
  }

  private onHashChange = () => this.restoreRoute();

  // --- Navigation handler for child events ---

  private handleNavigate(e: CustomEvent) {
    const { id } = e.detail;
    // Normalize: log-detail emits "ticket" (singular).
    const tab = e.detail.tab === "ticket" ? "tickets" : e.detail.tab;
    this.activeTab = tab;

    switch (tab) {
      case "tickets":
        this.ticketStore.selectTicket(id);
        break;
      case "templates":
        this.templateStore.selectTemplate(id);
        break;
      case "skills":
        this.skillStore.selectSkill(id);
        break;
      case "logs":
        this.logStore.selectSession(id);
        break;
      case "events":
        this.selectedEventId = id;
        break;
    }

    this.syncHash();
  }
  // --- Keyboard shortcuts & navigation guards ---

  /**
   * Get the currently active editable panel, if one exists for the
   * current tab. Returns null for tabs without editing (tickets, events, logs).
   */
  #getActiveEditor(): EditablePanel | null {
    if (this.activeTab === "templates") {
      return this.renderRoot.querySelector(
        "bees-template-detail"
      ) as EditablePanel | null;
    }
    if (this.activeTab === "skills") {
      return this.renderRoot.querySelector(
        "bees-skill-detail"
      ) as EditablePanel | null;
    }
    if (this.activeTab === "system") {
      return this.renderRoot.querySelector(
        "bees-system-detail"
      ) as EditablePanel | null;
    }
    return null;
  }

  /** Guard tab switches: confirm if dirty edits would be lost. */
  private switchTab(tab: TabId) {
    if (tab === this.activeTab) return;

    const editor = this.#getActiveEditor();
    if (editor?.hasDirtyEdits) {
      const discard = confirm(
        "You have unsaved changes. Discard and switch tabs?"
      );
      if (!discard) return;
      editor.cancelEditing();
    }

    this.activeTab = tab;
    this.syncHash();
  }

  #onKeyDown = (e: KeyboardEvent) => {
    // Cmd+S / Ctrl+S → save active editor.
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      const editor = this.#getActiveEditor();
      if (editor?.isEditing) {
        e.preventDefault();
        editor.triggerSave();
      }
    }

    // Escape → cancel active editor.
    if (e.key === "Escape") {
      const editor = this.#getActiveEditor();
      if (editor?.isEditing) {
        e.preventDefault();
        if (editor.hasDirtyEdits) {
          const discard = confirm("Discard unsaved changes?");
          if (!discard) return;
        }
        editor.cancelEditing();
      }
    }
  };

  #onBeforeUnload = (e: BeforeUnloadEvent) => {
    const editor = this.#getActiveEditor();
    if (editor?.hasDirtyEdits) {
      e.preventDefault();
    }
  };

  // --- Render ---

  render() {
    const access = this.stateAccess.accessState.get();

    if (access !== "ready") {
      return html`
        <div class="top-bar">
          <div class="top-bar-header">
            <h1>${APP_ICON} ${APP_NAME} Hivetool</h1>
          </div>
        </div>
        <div
          style="display:flex;align-items:center;justify-content:center;height:calc(100vh - 48px);flex-direction:column;gap:12px"
        >
          ${access === "none"
            ? html`
                <button @click=${() => this.handleAddHive()}>
                  📂 Open Hive Directory
                </button>
                <div style="font-size:0.75rem;color:#64748b">
                  Select a <code>hive/</code> directory to get started
                </div>
              `
            : html`
                <button @click=${() => this.handleRequestAccess()}>
                  🔑 Grant Access
                </button>
                <div style="font-size:0.75rem;color:#64748b">
                  Permission expired — click to re-authorize
                </div>
              `}
        </div>
      `;
    }

    // Flash state for currently updated items.
    const recentUpdate = this.ticketStore.recentlyUpdatedTicket.get();
    const flashTicketId =
      recentUpdate && Date.now() - recentUpdate.at < 15000
        ? recentUpdate.id
        : null;

    const recentLogUpdate = this.logStore.recentlyUpdatedSession.get();
    const flashLogId =
      recentLogUpdate && Date.now() - recentLogUpdate.at < 15000
        ? recentLogUpdate.id
        : null;

    return html`
      <div class="top-bar">
        <div class="top-bar-header">
          <h1>${APP_ICON} ${APP_NAME} Hivetool</h1>
          <div class="hive-switcher">
            ${this.renderHiveControl()}
            <button
              class="hive-picker-btn"
              @click=${() => {
                this.hivePickerOpen = !this.hivePickerOpen;
              }}
            >
              📂 ${this.stateAccess.hiveName.get() ?? ""}
              <span
                class="chevron ${this.hivePickerOpen ? "open" : ""}"
                >▾</span
              >
            </button>
            ${this.hivePickerOpen ? this.renderHivePicker() : nothing}
          </div>
        </div>
        <div class="top-bar-tabs">
          ${(
            [
              ["tickets", "Tasks", flashTicketId],
              ["events", "Events", null],
              ["logs", "Sessions", flashLogId],
              ["templates", "Templates", null],
              ["skills", "Skills", null],
              ["system", "System", null],
            ] as const
          ).map(
            ([id, label, flash]) => html`
              <div
                class="sidebar-tab ${this.activeTab === id
                  ? "active"
                  : ""} ${flash ? "lightning-flash" : ""}"
                @click=${() => this.switchTab(id)}
              >
                ${label}
              </div>
            `
          )}
        </div>
      </div>

      <div
        class="content-row"
        @navigate=${(e: CustomEvent) => this.handleNavigate(e)}
      >
        <div class="sidebar">
          ${this.renderSidebar(flashTicketId, flashLogId)}
        </div>
        <div class="main">${this.renderMain(flashTicketId)}</div>
      </div>
    `;
  }

  private renderHiveControl() {
    // Only show mutation-powered controls when the box is listening.
    if (!this.mutationClient.boxActive.get()) return nothing;

    const tickets = this.ticketStore.tickets.get();

    const hasActive = tickets.some(
      (t) =>
        t.status === "running" ||
        t.status === "available" ||
        t.status === "suspended"
    );
    const hasPaused = tickets.some((t) => t.status === "paused");

    if (hasActive) {
      return html`
        <button
          class="hive-control-btn stop"
          @click=${() => this.handleStop()}
        >
          ⏹ Pause All
        </button>
      `;
    }

    if (hasPaused) {
      return html`
        <button
          class="hive-control-btn resume"
          @click=${() => this.handleResume()}
        >
          ▶ Resume
        </button>
      `;
    }

    return html`
      <button class="hive-control-btn start" disabled>⏸ Idle</button>
    `;
  }

  private async handleStop() {
    const confirmed = confirm("Pause all running and pending tasks?");
    if (!confirmed) return;

    try {
      const id = await this.mutationClient.requestPauseAll();
      console.info("Pause-all mutation submitted:", id);
    } catch (e) {
      console.error("Failed to submit pause-all mutation:", e);
    }
  }

  private async handleResume() {
    try {
      const id = await this.mutationClient.requestResumeAll();
      console.info("Resume-paused mutation submitted:", id);
    } catch (e) {
      console.error("Failed to submit resume-paused mutation:", e);
    }
  }

  private renderSidebar(
    flashTicketId: string | null,
    flashLogId: string | null
  ) {
    switch (this.activeTab) {
      case "tickets":
        return html`<bees-ticket-list
          .store=${this.ticketStore}
          .flashTicketId=${flashTicketId}
          @select=${(e: CustomEvent) => {
            this.ticketStore.selectTicket(e.detail.id);
            this.syncHash();
          }}
        ></bees-ticket-list>`;
      case "events":
        return html`<bees-event-list
          .store=${this.ticketStore}
          .selectedEventId=${this.selectedEventId}
          @select=${(e: CustomEvent) => {
            this.selectedEventId = e.detail.id;
            this.syncHash();
          }}
        ></bees-event-list>`;
      case "logs":
        return html`<bees-log-list
          .store=${this.logStore}
          .flashLogId=${flashLogId}
          @select=${(e: CustomEvent) => {
            this.logStore.selectSession(e.detail.sessionId);
            this.syncHash();
          }}
        ></bees-log-list>`;
      case "templates":
        return html`<bees-template-list
          .store=${this.templateStore}
          @select=${(e: CustomEvent) => {
            this.templateStore.selectTemplate(e.detail.name);
            this.syncHash();
          }}
          @create=${() => {
            // Tell the detail panel to enter create mode.
            const detail = this.renderRoot.querySelector(
              "bees-template-detail"
            );
            if (detail)
              (detail as { startCreating(): void }).startCreating();
          }}
        ></bees-template-list>`;
      case "skills":
        return html`<bees-skill-list
          .store=${this.skillStore}
          @select=${(e: CustomEvent) => {
            this.skillStore.selectSkill(e.detail.dirName);
            this.syncHash();
          }}
          @create=${() => {
            const detail = this.renderRoot.querySelector(
              "bees-skill-detail"
            );
            if (detail)
              (detail as { startCreating(): void }).startCreating();
          }}
        ></bees-skill-list>`;
      case "system":
        return html``;
    }
  }

  private renderMain(flashTicketId: string | null) {
    switch (this.activeTab) {
      case "tickets":
        return html`<bees-ticket-pane
          .ticketStore=${this.ticketStore}
          .mutationClient=${this.mutationClient}
          .templateStore=${this.templateStore}
          .skillStore=${this.skillStore}
          .flashTicketId=${flashTicketId}
        ></bees-ticket-pane>`;
      case "events":
        return html`<bees-event-detail
          .ticketStore=${this.ticketStore}
          .selectedEventId=${this.selectedEventId}
        ></bees-event-detail>`;
      case "logs":
        return html`<bees-log-detail
          .data=${this.logStore.selectedView.get()}
        ></bees-log-detail>`;
      case "templates":
        return html`<bees-template-detail
          .templateStore=${this.templateStore}
          .skillStore=${this.skillStore}
          .ticketStore=${this.ticketStore}
        ></bees-template-detail>`;
      case "skills":
        return html`<bees-skill-detail
          .skillStore=${this.skillStore}
          .templateStore=${this.templateStore}
          .ticketStore=${this.ticketStore}
        ></bees-skill-detail>`;
      case "system":
        return html`<bees-system-detail
          .systemStore=${this.systemStore}
          .templateStore=${this.templateStore}
          .mutationClient=${this.mutationClient}
        ></bees-system-detail>`;
    }
  }

  private renderHivePicker() {
    const hives = this.stateAccess.hives.get();
    const activeId = this.stateAccess.activeHiveId.get();

    return html`
      <div
        class="hive-picker-backdrop"
        @click=${() => {
          this.hivePickerOpen = false;
        }}
      ></div>
      <div class="hive-picker-popover">
        ${hives.length > 0
          ? html`
              <div class="picker-header">Hives</div>
              <div class="picker-list">
                ${hives.map(
                  (h) => html`
                    <div
                      class="picker-item ${h.id === activeId
                        ? "active"
                        : ""}"
                      @click=${() => this.handleSwitchToHive(h.id)}
                    >
                      <span class="indicator"></span>
                      <span class="item-name">${h.name}</span>
                      <button
                        class="remove-btn"
                        title="Remove from list"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this.handleRemoveHive(h.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  `,
                )}
              </div>
              <div class="picker-divider"></div>
            `
          : nothing}
        <div
          class="picker-action"
          @click=${() => this.handleAddHive()}
        >
          ＋ Add Hive…
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-app": BeesApp;
  }
}
