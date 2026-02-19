/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { Task } from "@lit/task";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../styles/icons.js";
import { HideTooltipEvent, ShowTooltipEvent } from "../../events/events.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA, type Notebook } from "../../../sca/sca.js";
import { SignalWatcher } from "@lit-labs/signals";

/**
 * A self-contained component for rendering NotebookLM notebook thumbnails.
 * Fetches notebook data internally using the NotebookLM API client.
 *
 * Similar pattern to `bb-google-drive-file-viewer`.
 */
@customElement("bb-notebooklm-viewer")
export class NotebookLmViewer extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    css`
      :host {
        display: block;
      }

      .notebook-preview {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-3);
        min-height: 100px;
      }

      .link-out {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--bb-grid-size-8);
        height: var(--bb-grid-size-8);
        border-radius: var(--bb-grid-size-3);
        background: var(--light-dark-n-0);
        color: var(--light-dark-n-100);
        top: var(--bb-grid-size-3);
        right: var(--bb-grid-size-3);
        cursor: pointer;
        pointer-events: auto;

        & > .g-icon {
          pointer-events: none;
          font-size: 18px;
        }
      }

      .notebook-preview .text-content {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-1);
      }

      :host([displayMode="thumbnail"]) .notebook-preview {
        min-height: auto;
        height: 100%;
        padding: var(--bb-grid-size-2);
        justify-content: flex-start;
        align-items: flex-start;
        gap: var(--bb-grid-size);
        box-sizing: border-box;
      }

      .notebook-preview .notebook-emoji {
        font-size: 32px;
        line-height: 1;
      }

      :host([displayMode="thumbnail"]) .notebook-preview .notebook-emoji {
        font-size: 24px;
        width: 28px;
        text-align: center;
      }

      .notebook-preview .notebook-title {
        font: 600 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        color: var(--light-dark-n-10);
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      :host([displayMode="thumbnail"]) .notebook-preview .notebook-title {
        font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        text-align: left;
        -webkit-line-clamp: 2;
      }

      .notebook-preview .notebook-meta {
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        color: var(--light-dark-n-40);
        margin: 0;
      }

      :host([displayMode="thumbnail"]) .notebook-preview .notebook-meta {
        display: none;
      }

      :host([displayMode="thumbnail"]) .notebook-preview .text-content {
        align-items: flex-start;
      }

      .notebook-preview.loading,
      .notebook-preview.error {
        align-items: center;
        justify-content: center;
        background: var(--light-dark-n-95);
      }

      .notebook-preview.error {
        color: var(--bb-error-color);
      }

      .loading-text {
        margin: 0;
      }
    `,
  ];

  /**
   * The notebook ID (without the "notebooks/" prefix).
   * When set, triggers an API call to fetch notebook metadata.
   * Alternatively, set the `notebook` property directly to avoid fetching.
   */
  @property()
  accessor notebookId: string | null = null;

  /**
   * Directly provide notebook data instead of fetching via notebookId.
   * When set, the component will render immediately without an API call.
   */
  @property({ attribute: false })
  accessor notebook: Notebook | null = null;

  /**
   * Display mode for the viewer.
   * - "card": Full thumbnail with emoji, title, date, source count (default)
   * - "thumbnail": Compact centered display for small tiles (e.g. asset shelf)
   */
  @property({ reflect: true })
  accessor displayMode: "card" | "thumbnail" = "card";

  /**
   * Whether to show an external link button to open in NotebookLM.
   * Should be true for graph-asset/entity-viewer contexts, false for picker.
   */
  @property({ type: Boolean })
  accessor showExternalLink = false;

  @consume({ context: scaContext })
  accessor sca!: SCA;

  readonly #loadTask = new Task(this, {
    task: async ([notebookId, notebook]) => {
      // If notebook data is provided directly, use it
      if (notebook) {
        return notebook;
      }

      if (!notebookId || !this.sca?.services?.notebookLmApiClient) {
        return undefined;
      }

      const notebookName = `notebooks/${notebookId}`;

      const fetchedNotebook =
        await this.sca.services.notebookLmApiClient.getNotebook({
          name: notebookName,
        });

      return fetchedNotebook;
    },
    args: () => [this.notebookId, this.notebook] as const,
  });

  override render() {
    return this.#loadTask.render({
      pending: () =>
        html`<div class="notebook-preview loading">
          <p class="loading-text">Loading notebook...</p>
        </div>`,
      error: (e) => {
        this.dispatchEvent(new Event("outputsloaded"));
        return html`<div class="notebook-preview error">
          <p>${e instanceof Error ? e.message : "Failed to load notebook"}</p>
        </div>`;
      },
      complete: (notebook) => {
        this.dispatchEvent(new Event("outputsloaded"));
        return this.#renderNotebook(notebook);
      },
    });
  }

  #renderNotebook(notebook: Notebook | undefined) {
    if (!notebook) {
      return html`<div class="notebook-preview loading">
        <p class="loading-text">NotebookLM notebook</p>
      </div>`;
    }

    // Format the date
    const createTime = notebook.createTime
      ? new Date(notebook.createTime).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";

    // Pick a background color based on the notebook emoji
    const colorPalette = [
      "light-dark(#E8F0FE, #1A2744)", // blue
      "light-dark(#FCE8E6, #3D2222)", // red/pink
      "light-dark(#FEF7E0, #3A3118)", // yellow
      "light-dark(#E6F4EA, #1C3326)", // green
      "light-dark(#F3E8FD, #2E1F42)", // purple
      "light-dark(#E8EAED, #2A2D30)", // gray
    ];
    const emoji = notebook.emoji || "📓";
    const colorIndex = (emoji.codePointAt(0) ?? 0) % colorPalette.length;
    const bgColor = colorPalette[colorIndex];

    return html`<div class="notebook-preview" style="background: ${bgColor}">
      ${this.showExternalLink
        ? this.#renderExternalLinkButton(notebook)
        : nothing}
      <span class="notebook-emoji">${emoji}</span>
      <div class="text-content">
        <p class="notebook-title">
          ${notebook.displayName || "Untitled notebook"}
        </p>
        <p class="notebook-meta">
          ${createTime}${createTime && notebook.sourceCount
            ? " · "
            : ""}${notebook.sourceCount
            ? `${notebook.sourceCount} sources`
            : ""}
        </p>
      </div>
    </div>`;
  }

  #renderExternalLinkButton(notebook: Notebook) {
    const notebookId = notebook.name.replace("notebooks/", "");
    const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
    return html`
      <a href=${notebookUrl} target="_blank">
        <span
          class="link-out"
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Open in NotebookLM",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @click=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
        >
          <span class="g-icon filled heavy round">open_in_new</span>
        </span>
      </a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-notebooklm-viewer": NotebookLmViewer;
  }
}
