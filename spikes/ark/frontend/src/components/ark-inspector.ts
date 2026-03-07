/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ViewBundle } from "../types.js";
import { backend, type ReuseInfo } from "../services/backend.js";

export { ArkInspector };

/**
 * Extract props from a component's JSX source by finding the function
 * signature destructuring and default values.
 */
function extractProps(
  source: string
): Array<{ name: string; default?: string }> {
  const match = source.match(/function\s+\w+\s*\(\s*\{([^}]*)\}/);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((param) => {
      const [name, def] = param.split("=").map((s) => s.trim());
      return { name, default: def };
    });
}

/**
 * Inspector panel — "stats for nerds" sidebar in viewport mode.
 *
 * Shows:
 * - Component file list with reuse badges (✨ new / ♻️ reused)
 * - Extracted props for App.jsx
 * - File sizes and stats
 * - Reuse source info (which run a component came from)
 */
@customElement("ark-inspector")
class ArkInspector extends LitElement {
  @property({ type: Object }) bundle: ViewBundle | null = null;
  @state() private collapsed = false;
  @state() private selectedFile: string | null = null;
  @state() private reuseData: Record<string, ReuseInfo> = {};
  @state() private reuseLoading = false;

  static override styles = css`
    :host {
      display: block;
      width: 280px;
      flex-shrink: 0;
      background: #fafafa;
      border-left: 1px solid #e0e0e0;
      overflow-y: auto;
      font-size: 13px;
      color: #333;
    }

    :host([collapsed]) {
      width: 36px;
      overflow: hidden;
    }

    .toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid #e8e8e8;
      user-select: none;
    }

    .toggle-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #999;
    }

    .toggle-btn {
      border: none;
      background: none;
      cursor: pointer;
      color: #999;
      font-size: 14px;
      padding: 0;
      line-height: 1;
    }

    .toggle-btn:hover {
      color: #333;
    }

    .section {
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
    }

    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #aaa;
      margin-bottom: 8px;
    }

    .file-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .file-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-family: "SF Mono", "Menlo", monospace;
      font-size: 12px;
      color: #555;
      transition: background 0.1s;
    }

    .file-item:hover {
      background: #eee;
    }

    .file-item[data-active] {
      background: #e4e4e4;
      color: #111;
    }

    .file-icon {
      font-size: 11px;
      flex-shrink: 0;
    }

    .file-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-badge {
      font-size: 10px;
      flex-shrink: 0;
    }

    .file-size {
      font-size: 10px;
      color: #bbb;
      flex-shrink: 0;
    }

    .reuse-detail {
      padding: 4px 8px 8px;
      font-size: 11px;
      color: #888;
      border-left: 2px solid #e0e0e0;
      margin: 2px 0 4px 20px;
    }

    .reuse-source {
      font-style: italic;
    }

    .reuse-sim {
      font-family: "SF Mono", "Menlo", monospace;
      color: #999;
    }

    .prop-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .prop-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 3px 0;
    }

    .prop-name {
      font-family: "SF Mono", "Menlo", monospace;
      font-size: 12px;
      color: #333;
    }

    .prop-default {
      font-family: "SF Mono", "Menlo", monospace;
      font-size: 11px;
      color: #999;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty {
      color: #bbb;
      font-style: italic;
      font-size: 12px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 12px;
    }

    .stat-label {
      color: #999;
    }

    .stat-value {
      font-family: "SF Mono", "Menlo", monospace;
      color: #555;
    }
  `;

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has("bundle") && this.bundle) {
      this.#fetchReuse();
    }
  }

  async #fetchReuse() {
    if (!this.bundle) return;
    this.reuseLoading = true;
    try {
      this.reuseData = await backend.checkReuse(this.bundle.id);
    } catch {
      this.reuseData = {};
    } finally {
      this.reuseLoading = false;
    }
  }

  override render() {
    if (this.collapsed) {
      return html`
        <div class="toggle">
          <button class="toggle-btn" @click=${this.#toggleCollapse}>‹</button>
        </div>
      `;
    }

    const view = this.bundle?.views[0];
    const files = view?.files ?? {};
    const fileEntries = Object.entries(files);
    const props = files["App.jsx"] ? extractProps(files["App.jsx"]) : [];

    // Stats.
    const totalSize = fileEntries.reduce(
      (sum, [, content]) => sum + content.length,
      0
    );
    const componentCount = fileEntries.filter(([name]) =>
      name.endsWith(".jsx")
    ).length;
    const reusedCount = Object.values(this.reuseData).filter(
      (r) => r.status === "reused"
    ).length;
    const newCount = Object.values(this.reuseData).filter(
      (r) => r.status === "new"
    ).length;

    return html`
      <div class="toggle">
        <span class="toggle-label">Inspector</span>
        <button class="toggle-btn" @click=${this.#toggleCollapse}>›</button>
      </div>

      <div class="section">
        <div class="section-title">Files</div>
        <div class="file-list">
          ${fileEntries.length > 0
            ? fileEntries.map(([name, content]) => {
                const reuse = this.reuseData[name];
                return html`
                  <div
                    class="file-item"
                    ?data-active=${name === this.selectedFile}
                    @click=${() => this.#selectFile(name)}
                  >
                    <span class="file-icon"
                      >${name.endsWith(".css") ? "🎨" : "⚛"}</span
                    >
                    <span class="file-name">${name}</span>
                    ${reuse
                      ? html`<span
                          class="file-badge"
                          title=${reuse.status === "reused"
                            ? `♻️ ${reuse.library_file}`
                            : "✨ new component"}
                          >${reuse.status === "reused" ? "♻️" : "✨"}</span
                        >`
                      : nothing}
                    <span class="file-size"
                      >${this.#formatSize(content.length)}</span
                    >
                  </div>
                  ${reuse?.status === "reused" && name === this.selectedFile
                    ? html`<div class="reuse-detail">
                        <span class="reuse-sim">→ ${reuse.library_file}</span>
                      </div>`
                    : nothing}
                `;
              })
            : html`<div class="empty">No files</div>`}
        </div>
      </div>

      ${props.length > 0
        ? html`
            <div class="section">
              <div class="section-title">Props (App)</div>
              <div class="prop-list">
                ${props.map(
                  (p) => html`
                    <div class="prop-item">
                      <span class="prop-name">${p.name}</span>
                      ${p.default
                        ? html`<span class="prop-default">${p.default}</span>`
                        : nothing}
                    </div>
                  `
                )}
              </div>
            </div>
          `
        : nothing}

      <div class="section">
        <div class="section-title">Stats</div>
        <div class="stat-row">
          <span class="stat-label">Components</span>
          <span class="stat-value">${componentCount}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Files</span>
          <span class="stat-value">${fileEntries.length}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total size</span>
          <span class="stat-value">${this.#formatSize(totalSize)}</span>
        </div>
        ${!this.reuseLoading && (newCount > 0 || reusedCount > 0)
          ? html`
              <div class="stat-row">
                <span class="stat-label">Reuse</span>
                <span class="stat-value">✨${newCount} · ♻️${reusedCount}</span>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  #toggleCollapse() {
    this.collapsed = !this.collapsed;
    if (this.collapsed) {
      this.setAttribute("collapsed", "");
    } else {
      this.removeAttribute("collapsed");
    }
  }

  #selectFile(name: string) {
    this.selectedFile = this.selectedFile === name ? null : name;
    this.dispatchEvent(
      new CustomEvent("select-file", {
        detail: { file: this.selectedFile },
        bubbles: true,
        composed: true,
      })
    );
  }

  #formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
}
