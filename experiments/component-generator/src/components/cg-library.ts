/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<cg-library>` — Component library list in the sidebar.
 *
 * Displays generated components grouped by generation, with:
 * - **Search filtering** across component names
 * - **Expand/collapse** for generation groups with sub-components
 * - **Selection** highlighting (reads `selectedTag` signal)
 * - **Delete** for entire generation groups
 *
 * The library re-renders automatically when `selectedTag`, `searchQuery`,
 * or the registry contents change (via signal-driven reactivity).
 *
 * ## Grouping
 *
 * Components from the same generation are grouped together. The main
 * (parent) component is shown as the group header, with sub-components
 * nested underneath when expanded.
 *
 * ## Events
 *
 * This component doesn't directly call actions — it dispatches a
 * `component-selected` event with `{ tag }` detail so the parent can
 * handle selection (which involves iframe rendering, TweakPane updates,
 * etc.)
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { registry } from "../core/registry.js";
import { appState } from "../state.js";

@customElement("cg-library")
export class CgLibrary extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .library-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 0;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--host-text-muted);
    }

    .library-count {
      font-size: 11px;
      color: var(--host-text-muted);
      background: var(--host-surface-3);
      padding: 2px 8px;
      border-radius: 10px;
    }

    .library-search {
      margin: 8px 20px;
      padding: 8px 12px;
      background: var(--host-surface-2);
      border: 1px solid var(--host-border);
      border-radius: var(--host-radius-sm);
      color: var(--host-text);
      font-size: 13px;
      outline: none;
      font-family: var(--host-font);
    }
    .library-search:focus {
      border-color: var(--host-accent-dim);
    }
    .library-search::placeholder {
      color: var(--host-text-muted);
    }

    .library-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 12px 16px;
    }

    .empty-state {
      text-align: center;
      color: var(--host-text-muted);
      font-size: 13px;
      padding: 24px 12px;
    }

    /* ── Groups ── */
    .library-group {
      margin-bottom: 2px;
    }
    .library-group.active {
      background: var(--host-accent-glow);
      border-radius: var(--host-radius-sm);
    }

    .library-group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px;
      border-radius: var(--host-radius-sm);
      cursor: pointer;
      transition: background 0.1s;
    }
    .library-group-header:hover {
      background: var(--host-surface-2);
    }
    .library-group-header.selected {
      background: var(--host-surface-3);
    }

    .library-group-toggle {
      background: none;
      border: none;
      color: var(--host-text-muted);
      font-size: 10px;
      cursor: pointer;
      padding: 2px 4px;
      flex-shrink: 0;
      width: 20px;
      text-align: center;
    }
    .library-group-spacer {
      width: 20px;
      flex-shrink: 0;
    }

    .library-item-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--host-accent);
      flex-shrink: 0;
    }

    .library-item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .library-item-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--host-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .library-item-tag {
      font-size: 11px;
      color: var(--host-text-muted);
      font-family: var(--host-font-mono);
    }

    .library-item-delete {
      background: none;
      border: none;
      color: var(--host-text-muted);
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .library-group-header:hover .library-item-delete {
      opacity: 1;
    }
    .library-item-delete:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    /* ── Children ── */
    .library-group-children {
      padding-left: 28px;
    }
    .library-child-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 8px;
      border-radius: var(--host-radius-sm);
      cursor: pointer;
      transition: background 0.1s;
    }
    .library-child-item:hover {
      background: var(--host-surface-2);
    }
    .library-child-item.selected {
      background: var(--host-surface-3);
    }
  `;

  /** Tracks which generation groups are expanded in the tree. */
  @state()
  accessor expandedGroups = new Set<string>();

  override render() {
    const total = registry.size;
    const query = appState.searchQuery;
    const activeTag = appState.selectedTag;

    return html`
      <div class="library-header">
        <h2 class="section-title">Library</h2>
        ${total > 0
          ? html`<span class="library-count">${total}</span>`
          : nothing}
      </div>
      <input
        class="library-search"
        type="text"
        placeholder="🔍 Filter components…"
        autocomplete="off"
        @input=${this.#onSearch}
      />
      <div class="library-list">
        ${total === 0
          ? html`<p class="empty-state">
              No components yet. Describe one above to get started.
            </p>`
          : this.#renderGroups(query, activeTag)}
      </div>
    `;
  }

  #renderGroups(query: string, activeTag: string | null) {
    const groups = registry.groups();
    const fragments = [];

    for (const group of groups) {
      const { main, children } = group;

      // Search filtering.
      const mainMatches = this.#matchesSearch(
        query,
        main.name,
        main.componentName
      );
      const matchingChildren = children.filter((c) =>
        this.#matchesSearch(query, c.name, c.componentName)
      );
      if (!mainMatches && matchingChildren.length === 0) continue;

      const isExpanded = this.expandedGroups.has(main.generationId);
      const hasChildren = children.length > 0;
      const isActive = main.tag === activeTag;
      const hasActiveChild = children.some((c) => c.tag === activeTag);

      fragments.push(html`
        <div
          class="library-group ${isActive || hasActiveChild ? "active" : ""}"
        >
          <div
            class="library-group-header ${isActive ? "selected" : ""}"
            @click=${() => this.#onSelect(main.tag)}
          >
            ${hasChildren
              ? html`<button
                  class="library-group-toggle"
                  @click=${(e: Event) => this.#onToggle(e, main.generationId)}
                >
                  ${isExpanded ? "▾" : "▸"}
                </button>`
              : html`<span class="library-group-spacer"></span>`}
            <span class="library-item-dot"></span>
            <div class="library-item-info">
              <span class="library-item-name">${main.name}</span>
              <span class="library-item-tag"
                >&lt;${main.componentName} /&gt;</span
              >
            </div>
            <button
              class="library-item-delete"
              title="Delete group"
              @click=${(e: Event) => this.#onDelete(e, main.tag)}
            >
              ×
            </button>
          </div>
          ${hasChildren && isExpanded
            ? html`<div class="library-group-children">
                ${(query ? matchingChildren : children).map(
                  (child) => html`
                    <div
                      class="library-child-item ${child.tag === activeTag
                        ? "selected"
                        : ""}"
                      @click=${() => this.#onSelect(child.tag)}
                    >
                      <span class="library-item-name">${child.name}</span>
                      <span class="library-item-tag"
                        >&lt;${child.componentName} /&gt;</span
                      >
                    </div>
                  `
                )}
              </div>`
            : nothing}
        </div>
      `);
    }

    return fragments;
  }

  #matchesSearch(query: string, ...fields: string[]): boolean {
    if (!query) return true;
    return fields.some((f) => f.toLowerCase().includes(query));
  }

  #onSearch(e: Event) {
    appState.searchQuery = (e.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
  }

  #onSelect(tag: string) {
    appState.selectedTag = tag;
  }

  #onToggle(e: Event, genId: string) {
    e.stopPropagation();
    const next = new Set(this.expandedGroups);
    if (next.has(genId)) {
      next.delete(genId);
    } else {
      next.add(genId);
    }
    this.expandedGroups = next;
  }

  #onDelete(e: Event, tag: string) {
    e.stopPropagation();
    const component = registry.get(tag);
    if (component) {
      const genId = component.generationId;
      for (const c of registry.all()) {
        if (c.generationId === genId) {
          registry.delete(c.tag);
        }
      }
    } else {
      registry.delete(tag);
    }

    if (appState.selectedTag === tag || !registry.has(tag)) {
      appState.selectedTag = null;
    }

    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cg-library": CgLibrary;
  }
}
