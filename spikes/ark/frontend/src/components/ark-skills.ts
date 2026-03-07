/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  backend,
  type SkillSummary,
  type SkillDetail,
} from "../services/backend.js";

export { ArkSkills };

/**
 * Skill browser panel — shows available skills, lets users view details
 * and delete skills. Monochrome design consistent with the Ark chrome.
 */
@customElement("ark-skills")
class ArkSkills extends LitElement {
  @state() private skills: SkillSummary[] = [];
  @state() private selectedSkill: SkillDetail | null = null;
  @state() private loading = true;
  @state() private refreshing = false;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fafafa;
      color: #333;
      font-size: 13px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .header h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #999;
    }

    .back-btn {
      border: none;
      background: none;
      cursor: pointer;
      color: #999;
      font-size: 13px;
      padding: 0;
    }

    .back-btn:hover {
      color: #333;
    }

    .skill-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .skill-card {
      padding: 12px;
      border: 1px solid #e8e8e8;
      border-radius: 6px;
      margin-bottom: 6px;
      cursor: pointer;
      transition:
        background 0.1s,
        border-color 0.1s;
    }

    .skill-card:hover {
      background: #f0f0f0;
      border-color: #d0d0d0;
    }

    .skill-name {
      font-weight: 600;
      font-size: 13px;
      color: #222;
      margin-bottom: 4px;
    }

    .skill-desc {
      font-size: 11px;
      color: #888;
      line-height: 1.4;
    }

    .skill-slug {
      font-family: "SF Mono", "Menlo", monospace;
      font-size: 10px;
      color: #bbb;
      margin-top: 4px;
    }

    .detail {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .detail-header {
      padding: 14px 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .detail-header h3 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: #222;
    }

    .detail-header p {
      margin: 0;
      font-size: 11px;
      color: #888;
    }

    .detail-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .delete-btn {
      border: 1px solid #ddd;
      background: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      color: #999;
      cursor: pointer;
      transition: all 0.15s;
    }

    .delete-btn:hover {
      background: #fee;
      border-color: #e88;
      color: #c44;
    }

    .detail-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
    }

    .content-pre {
      font-family: "SF Mono", "Menlo", monospace;
      font-size: 11px;
      line-height: 1.5;
      color: #555;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }

    .empty {
      text-align: center;
      padding: 40px 16px;
      color: #bbb;
      font-style: italic;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #ccc;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.#loadSkills();
  }

  async #loadSkills() {
    this.loading = true;
    this.skills = await backend.listSkills();
    this.loading = false;
  }

  async #selectSkill(slug: string) {
    this.selectedSkill = await backend.getSkill(slug);
  }

  async #deleteSkill(slug: string) {
    await backend.deleteSkill(slug);
    this.selectedSkill = null;
    await this.#loadSkills();
  }

  async #refreshSkill(slug: string) {
    this.refreshing = true;
    await backend.refreshSkill(slug);
    this.selectedSkill = await backend.getSkill(slug);
    this.refreshing = false;
  }

  #back() {
    this.selectedSkill = null;
  }

  override render() {
    if (this.selectedSkill) {
      return this.#renderDetail(this.selectedSkill);
    }
    return this.#renderList();
  }

  #renderList() {
    return html`
      <div class="header">
        <h2>Skills</h2>
      </div>
      ${this.loading
        ? html`<div class="loading">Loading…</div>`
        : this.skills.length === 0
          ? html`<div class="empty">No skills found</div>`
          : html`
              <div class="skill-list">
                ${this.skills.map(
                  (s) => html`
                    <div
                      class="skill-card"
                      @click=${() => this.#selectSkill(s.slug)}
                    >
                      <div class="skill-name">${s.name}</div>
                      <div class="skill-desc">${s.description}</div>
                      <div class="skill-slug">${s.slug}</div>
                    </div>
                  `
                )}
              </div>
            `}
    `;
  }

  #renderDetail(skill: SkillDetail) {
    const audit = skill.knowledge_audit;
    return html`
      <div class="header">
        <button class="back-btn" @click=${this.#back}>← Skills</button>
      </div>
      <div class="detail">
        <div class="detail-header">
          <h3>${skill.name}</h3>
          <p>${skill.description}</p>
          ${audit ? this.#renderAudit(audit) : ""}
          <div class="detail-actions">
            ${audit?.status === "stale"
              ? html`<button
                  class="delete-btn"
                  style="background: #fff3e0; border-color: #ffe0b2; color: #e65100;"
                  ?disabled=${this.refreshing}
                  @click=${() => this.#refreshSkill(skill.slug)}
                >
                  ${this.refreshing ? "Refreshing…" : "⟳ Refresh Skill"}
                </button>`
              : ""}
            <button
              class="delete-btn"
              @click=${() => this.#deleteSkill(skill.slug)}
            >
              Delete skill
            </button>
          </div>
        </div>
        <div class="detail-content">
          <pre class="content-pre">${skill.content}</pre>
        </div>
      </div>
    `;
  }

  #renderAudit(audit: {
    status: string;
    sources: Array<{ path: string; status: string }>;
  }) {
    const isCurrent = audit.status === "current";
    const isUnknown = audit.status === "unknown";

    if (isUnknown) return "";

    const statusIcon = (s: string) => {
      switch (s) {
        case "current":
          return "✓";
        case "changed":
          return "⚠";
        case "new_untracked":
          return "✚";
        case "missing":
          return "✕";
        default:
          return "?";
      }
    };

    return html`
      <div
        class="audit-block"
        style="
        margin-top: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 11px;
        background: ${isCurrent ? "#e8f5e9" : "#fff3e0"};
        border: 1px solid ${isCurrent ? "#c8e6c9" : "#ffe0b2"};
        color: ${isCurrent ? "#2e7d32" : "#e65100"};
      "
      >
        <div style="font-weight: 600; margin-bottom: 4px;">
          ${isCurrent
            ? "✅ Knowledge current"
            : "⚠️ Knowledge stale — CPD needed"}
        </div>
        ${audit.sources.map(
          (s) => html`
            <div
              style="
              font-size: 10px;
              color: #666;
              margin-left: 4px;
              font-family: 'SF Mono', 'Menlo', monospace;
            "
            >
              ${statusIcon(s.status)} ${s.path}
              <span style="color: #aaa;">(${s.status})</span>
            </div>
          `
        )}
      </div>
    `;
  }
}
