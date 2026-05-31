/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { icons } from "../../../../src/ui/styles/icons.js";
import { ParsedFileMedata } from "../parse-file-name.js";

export { EvalSimplifiedFileList };

@customElement("eval-simplified-file-list")
class EvalSimplifiedFileList extends LitElement {
  @property()
  accessor files: ParsedFileMedata[] = [];

  @property()
  accessor selectedFilePath: string | null = null;

  static styles = [
    icons,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-2);
        padding: 0;
        height: 100%;
        overflow-y: auto;
        scrollbar-width: none;
      }

      .item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-2);
        background: var(--elevated-background-light);
        border: 1px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:hover {
          background: oklch(from var(--primary) l c h / 0.1);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px oklch(from var(--light-dark-n-10) l c h / 0.1);
        }

        &.selected {
          border-color: var(--primary);
          background: oklch(from var(--primary) l c h / 0.15);
          transform: none;
          box-shadow: none;
        }

        .title {
          font-family: var(--font-family);
          font-size: 13px;
          font-weight: 500;
          color: var(--text-color);
          flex-grow: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-right: var(--bb-grid-size-3);
        }

        .meta {
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-2);
          flex-shrink: 0;
        }

        .badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--light-dark-n-0);
          color: var(--light-dark-n-100);

          & .g-icon {
            font-size: 12px;
            color: var(--light-dark-n-100);
          }
        }

        .rating {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 8px;
          border: none;

          &.pass {
            background: #34a853;
            color: white;
          }
          &.partial {
            background: #fbbc04;
            color: black;
          }
          &.fail {
            background: #ea4335;
            color: white;
          }
          &.unknown {
            background: var(--border-color);
            color: var(--text-color);
          }

          & .g-icon {
            font-size: 14px;
          }
        }
      }
    `,
  ];

  render() {
    if (!this.files || this.files.length === 0) {
      return html`<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--light-dark-n-60); font-size: 13px;">
        No eval sessions found.
      </div>`;
    }

    return map(this.files, (f) => {
      const isSelected = f.path === this.selectedFilePath;
      const title = f.title || f.name || "Untitled Graph";
      const count = f.noteCount || 0;
      const rating = f.rating || f.judgement || "UNKNOWN";

      const ratingClass = {
        rating: true,
        pass: rating === "PASS" || rating === 5 || rating === 4,
        partial: rating === "PARTIAL" || rating === 3,
        fail: rating === "FAIL" || rating === 1 || rating === 2,
        unknown: rating === "UNKNOWN",
      };

      const ratingIcon =
        rating === "PASS" || rating === 5 || rating === 4
          ? "check_circle"
          : rating === "PARTIAL" || rating === 3
            ? "warning"
            : rating === "FAIL" || rating === 1 || rating === 2
              ? "cancel"
              : "";

      return html`<div
        class=${classMap({ item: true, selected: isSelected })}
        @click=${() => {
          this.dispatchEvent(
            new CustomEvent("file-selected", {
              detail: { file: f, path: f.path },
              bubbles: true,
              composed: true,
            })
          );
        }}
      >
        <span class="title" title="${title}">${title}</span>
        <div class="meta">
          ${count > 0
            ? html`<span class="badge" title="${count} comments">
                <span class="g-icon filled round">comment</span>
                ${count}
              </span>`
            : nothing}
          ${ratingIcon
            ? html`<span class=${classMap(ratingClass)} title="Rating: ${rating}">
                <span class="g-icon filled round">${ratingIcon}</span>
                ${rating}
              </span>`
            : nothing}
        </div>
      </div>`;
    });
  }
}
