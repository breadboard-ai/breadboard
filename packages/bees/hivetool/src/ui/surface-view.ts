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
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { SurfaceManifest, SurfaceItem } from "../data/types.js";

export { BeesSurfaceView };

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
  `;

  @property({ attribute: false })
  accessor surface: SurfaceManifest | null = null;

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

    return html`
      <div class="item-card ${roleClass}">
        <div class="item-title">${item.title}</div>
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
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-surface-view": BeesSurfaceView;
  }
}
