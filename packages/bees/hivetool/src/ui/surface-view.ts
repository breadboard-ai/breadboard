/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Surface view — renders an agent's curated presentation manifest.
 *
 * Displays the structured content from `surface.json`: title, sections
 * as labeled groups, items as cards with title and description text.
 * Status items render as compact inline indicators.
 *
 * Items with a `path` are expandable — clicking toggles an on-demand
 * content preview area. Markdown files render as formatted HTML via
 * the shared markdown directive; other text files render as `<pre>`.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { SurfaceManifest, SurfaceItem } from "../data/types.js";
import { markdown } from "../../../common/markdown.js";

export { BeesSurfaceView };

/**
 * Callback for loading file content on demand.
 * Accepts a path string, returns the text content or null.
 */
export type ContentLoader = (path: string) => Promise<string | null>;

@customElement("bees-surface-view")
class BeesSurfaceView extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .surface-header {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 8px;
    }

    .surface-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #f8fafc;
    }

    .surface-version {
      font-size: 0.65rem;
      color: #64748b;
      font-family: "Google Mono", "Roboto Mono", monospace;
    }

    .section-group {
      margin-bottom: 12px;
    }

    .section-heading {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid #1e293b;
    }

    .section-description {
      font-size: 0.7rem;
      color: #64748b;
      margin-bottom: 6px;
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .item-card {
      padding: 8px 12px;
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 6px;
      transition: border-color 0.15s;
    }

    .item-card:hover {
      border-color: #334155;
    }

    .item-card.primary {
      border-left: 3px solid #3b82f6;
    }

    .item-card.expandable {
      cursor: pointer;
      user-select: none;
    }

    .item-card.expanded {
      border-color: #334155;
    }

    .item-header {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .expand-indicator {
      font-size: 0.6rem;
      color: #64748b;
      transition: transform 0.15s;
      flex-shrink: 0;
    }

    .expand-indicator.open {
      transform: rotate(90deg);
    }

    .item-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 2px;
    }

    .item-description {
      font-size: 0.75rem;
      color: #94a3b8;
      line-height: 1.4;
    }

    .item-path {
      font-size: 0.65rem;
      color: #64748b;
      font-family: "Google Mono", "Roboto Mono", monospace;
      margin-top: 4px;
    }

    .item-badges {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }

    .badge {
      font-size: 0.6rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge.bundle {
      background: #312e81;
      color: #a5b4fc;
    }

    .badge.supporting {
      background: #1e293b;
      color: #94a3b8;
    }

    /* Status items render inline, not as cards. */
    .status-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      font-size: 0.7rem;
      color: #94a3b8;
      margin-right: 6px;
      margin-bottom: 4px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      flex-shrink: 0;
    }

    /* ── Content preview ── */
    .content-preview {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #1e293b;
    }

    .content-loading {
      font-size: 0.7rem;
      color: #64748b;
      font-style: italic;
    }

    .content-error {
      font-size: 0.7rem;
      color: #f87171;
    }

    .content-raw {
      margin: 0;
      font-size: 0.75rem;
      font-family: "Google Mono", "Roboto Mono", monospace;
      color: #cbd5e1;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 400px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #334155 transparent;
    }

    .content-markdown {
      font-size: 0.8rem;
      color: #e2e8f0;
      line-height: 1.6;
      max-height: 600px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #334155 transparent;
    }

    .content-markdown h1,
    .content-markdown h2,
    .content-markdown h3 {
      color: #f8fafc;
      margin: 0.6em 0 0.3em;
      line-height: 1.3;
    }

    .content-markdown h1 { font-size: 1.1rem; }
    .content-markdown h2 { font-size: 0.95rem; }
    .content-markdown h3 { font-size: 0.85rem; }

    .content-markdown h1:first-child {
      margin-top: 0;
    }

    .content-markdown p {
      margin: 0.4em 0;
    }

    .content-markdown ul,
    .content-markdown ol {
      margin: 0.4em 0;
      padding-left: 1.5em;
    }

    .content-markdown code {
      background: #1e293b;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: "Google Mono", "Roboto Mono", monospace;
      font-size: 0.85em;
    }

    .content-markdown pre {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 4px;
      padding: 8px 12px;
      overflow-x: auto;
      margin: 0.5em 0;
    }

    .content-markdown pre code {
      background: none;
      padding: 0;
      font-size: 0.8rem;
    }

    .content-markdown a {
      color: #60a5fa;
    }

    .content-markdown blockquote {
      border-left: 3px solid #334155;
      margin: 0.5em 0;
      padding: 0 0 0 12px;
      color: #94a3b8;
    }

    .content-markdown table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5em 0;
      font-size: 0.75rem;
    }

    .content-markdown th,
    .content-markdown td {
      border: 1px solid #1e293b;
      padding: 4px 8px;
      text-align: left;
    }

    .content-markdown th {
      background: #14171c;
      color: #94a3b8;
      font-weight: 600;
    }
  `;

  @property({ attribute: false })
  accessor surface: SurfaceManifest | null = null;

  /** Optional loader for on-demand content preview. */
  @property({ attribute: false })
  accessor contentLoader: ContentLoader | null = null;

  /** Set of item IDs whose content preview is expanded. */
  @state() accessor expandedItems: Set<string> = new Set();

  /** Cache of loaded content keyed by item ID. */
  #contentCache = new Map<string, string | null>();

  /** Set of item IDs currently loading. */
  #loadingItems = new Set<string>();

  render() {
    if (!this.surface) return nothing;
    const { title, version, sections, items } = this.surface;

    // Group items by section.
    const sectionMap = new Map<string | undefined, SurfaceItem[]>();
    for (const item of items) {
      const key = item.section;
      const group = sectionMap.get(key) ?? [];
      group.push(item);
      sectionMap.set(key, group);
    }

    // Separate status items from content items.
    const statusItems = items.filter((i) => i.role === "status");
    const contentSections = sections ?? [];

    return html`
      <div class="surface-header">
        ${title
          ? html`<span class="surface-title">${title}</span>`
          : nothing}
        <span class="surface-version">v${version}</span>
      </div>

      ${statusItems.length > 0
        ? html`<div style="margin-bottom: 10px">
            ${statusItems.map(
              (item) => html`
                <span class="status-item">
                  <span class="status-dot"></span>
                  ${item.description ?? item.title}
                </span>
              `
            )}
          </div>`
        : nothing}

      ${contentSections.map((section) => {
        const sectionItems = (sectionMap.get(section.id) ?? []).filter(
          (i) => i.role !== "status"
        );
        if (sectionItems.length === 0) return nothing;
        return html`
          <div class="section-group">
            <div class="section-heading">${section.title}</div>
            ${section.description
              ? html`<div class="section-description">
                  ${section.description}
                </div>`
              : nothing}
            <div class="items">
              ${sectionItems.map((item) => this.renderItem(item))}
            </div>
          </div>
        `;
      })}

      ${this.renderDefaultSection(sectionMap, contentSections)}
    `;
  }

  /** Render items that have no section (the default/ungrouped section). */
  private renderDefaultSection(
    sectionMap: Map<string | undefined, SurfaceItem[]>,
    declaredSections: { id: string }[]
  ) {
    const declaredIds = new Set(declaredSections.map((s) => s.id));
    // Collect items with no section or a section not in the declared list.
    const defaultItems = [...(sectionMap.get(undefined) ?? [])];
    for (const [key, items] of sectionMap) {
      if (key !== undefined && !declaredIds.has(key)) {
        defaultItems.push(...items);
      }
    }
    // Exclude status items — already rendered above.
    const contentItems = defaultItems.filter((i) => i.role !== "status");
    if (contentItems.length === 0) return nothing;

    return html`
      <div class="items" style="margin-top: 6px">
        ${contentItems.map((item) => this.renderItem(item))}
      </div>
    `;
  }

  private renderItem(item: SurfaceItem) {
    const roleClass = item.role === "primary" ? "primary" : "";
    const canExpand = !!item.path && !!this.contentLoader;
    const isExpanded = this.expandedItems.has(item.id);
    const expandClass = canExpand ? "expandable" : "";
    const expandedClass = isExpanded ? "expanded" : "";

    return html`
      <div
        class="item-card ${roleClass} ${expandClass} ${expandedClass}"
        @click=${canExpand ? () => this.#toggleItem(item) : nothing}
      >
        <div class="item-header">
          ${canExpand
            ? html`<span
                class="expand-indicator ${isExpanded ? "open" : ""}"
                >▶</span
              >`
            : nothing}
          <span class="item-title">${item.title}</span>
        </div>
        ${item.description
          ? html`<div class="item-description">${item.description}</div>`
          : nothing}
        ${item.path
          ? html`<div class="item-path">📄 ${item.path}</div>`
          : nothing}
        ${item.render || item.role === "supporting"
          ? html`<div class="item-badges">
              ${item.render
                ? html`<span class="badge bundle">${item.render}</span>`
                : nothing}
              ${item.role === "supporting"
                ? html`<span class="badge supporting">supporting</span>`
                : nothing}
            </div>`
          : nothing}
        ${isExpanded ? this.#renderContentPreview(item) : nothing}
      </div>
    `;
  }

  #toggleItem(item: SurfaceItem) {
    const next = new Set(this.expandedItems);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.add(item.id);
      this.#loadContent(item);
    }
    this.expandedItems = next;
  }

  async #loadContent(item: SurfaceItem) {
    if (!item.path || !this.contentLoader) return;
    if (this.#contentCache.has(item.id)) return;
    if (this.#loadingItems.has(item.id)) return;

    this.#loadingItems.add(item.id);
    this.requestUpdate();

    try {
      const content = await this.contentLoader(item.path);
      this.#contentCache.set(item.id, content);
    } catch {
      this.#contentCache.set(item.id, null);
    } finally {
      this.#loadingItems.delete(item.id);
      this.requestUpdate();
    }
  }

  #renderContentPreview(item: SurfaceItem) {
    if (this.#loadingItems.has(item.id)) {
      return html`<div class="content-preview">
        <span class="content-loading">Loading…</span>
      </div>`;
    }

    const content = this.#contentCache.get(item.id);
    if (content === undefined) {
      // Not yet loaded — trigger load.
      this.#loadContent(item);
      return html`<div class="content-preview">
        <span class="content-loading">Loading…</span>
      </div>`;
    }

    if (content === null) {
      return html`<div class="content-preview">
        <span class="content-error">Could not load content</span>
      </div>`;
    }

    const isMarkdown = item.path?.endsWith(".md");
    return html`<div class="content-preview">
      ${isMarkdown
        ? html`<div class="content-markdown">${markdown(content)}</div>`
        : html`<pre class="content-raw">${content}</pre>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-surface-view": BeesSurfaceView;
  }
}
