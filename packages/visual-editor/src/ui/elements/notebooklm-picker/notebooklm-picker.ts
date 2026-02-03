/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  InputCancelEvent,
  InputChangeEvent,
} from "../../plugins/input-plugin.js";
import {
  Notebook,
  OriginProductType,
  ApplicationPlatform,
  DeviceType,
} from "../../../sca/services/notebooklm-api-client.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { ModalDismissedEvent } from "../../events/events.js";
import "../shell/modal.js";

export type NotebookPickedValue = {
  /** A special value recognized by the "GraphPortLabel": if present, used as the preview. */
  preview: string;
  /** The notebook ID (without notebooks/ prefix). */
  id: string;
  /** The full resource name (notebooks/{id}). */
  name: string;
  /** Optional emoji for display. */
  emoji?: string;
};

type PickerState = "idle" | "loading" | "error";

@customElement("bb-notebooklm-picker")
export class NotebookLmPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .notebook-list {
      margin: 0;
      padding: 0;
      list-style: none;
      min-width: 280px;
      max-height: 300px;
      overflow-y: auto;
    }

    .notebook-item {
      display: flex;
      align-items: center;
      gap: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      cursor: pointer;
      border-radius: var(--bb-grid-size);
      transition: background 0.15s ease;
    }

    .notebook-item:hover {
      background: var(--light-dark-n-95);
    }

    .notebook-emoji {
      font-size: 20px;
      width: 24px;
      text-align: center;
    }

    .notebook-name {
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--light-dark-n-10);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .loading,
    .error {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--bb-grid-size-6);
      color: var(--light-dark-n-40);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }

    .error {
      color: var(--bb-error-color);
    }

    .empty-state {
      padding: var(--bb-grid-size-6);
      text-align: center;
      color: var(--light-dark-n-40);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }
  `;

  @property({ type: Boolean })
  accessor open = false;

  @property()
  accessor value: NotebookPickedValue | null = null;

  @state()
  accessor #pickerState: PickerState = "idle";

  @state()
  accessor #notebooks: Notebook[] = [];

  @state()
  accessor #errorMessage = "";

  @consume({ context: scaContext })
  accessor sca!: SCA;

  /** Opens the picker dialog and fetches notebooks. */
  triggerFlow() {
    this.open = true;
    this.#fetchNotebooks();
  }

  async #fetchNotebooks() {
    this.#pickerState = "loading";
    this.#notebooks = [];
    this.#errorMessage = "";

    try {
      const response =
        await this.sca.services.notebookLmApiClient.listNotebooks({
          provenance: {
            originProductType: OriginProductType.GOOGLE_NOTEBOOKLM_EVALS,
            clientInfo: {
              applicationPlatform: ApplicationPlatform.WEB,
              device: DeviceType.DESKTOP,
            },
          },
        });
      this.#notebooks = response.notebooks || [];
      this.#pickerState = "idle";
    } catch (err) {
      console.error("Failed to fetch notebooks:", err);
      this.#pickerState = "error";
      this.#errorMessage =
        err instanceof Error ? err.message : "Failed to fetch notebooks";
    }
  }

  #handleClose() {
    this.open = false;
    this.dispatchEvent(new InputCancelEvent());
  }

  #handleSelectNotebook(notebook: Notebook) {
    // Extract ID from name (format: "notebooks/{id}")
    const id = notebook.name.replace("notebooks/", "");
    this.value = {
      id,
      name: notebook.name,
      preview: notebook.displayName || id,
      emoji: notebook.emoji,
    };
    this.open = false;
    this.dispatchEvent(new InputChangeEvent(this.value));
  }

  override render() {
    if (!this.open) {
      return nothing;
    }

    return html`
      <bb-modal
        modalTitle="Select a Notebook"
        .showCloseButton=${true}
        @bbmodaldismissed=${(evt: ModalDismissedEvent) => {
          if (!evt.withSave) {
            this.#handleClose();
          }
        }}
      >
        ${this.#renderContent()}
      </bb-modal>
    `;
  }

  #renderContent() {
    switch (this.#pickerState) {
      case "loading":
        return html`<div class="loading">Loading notebooks...</div>`;
      case "error":
        return html`<div class="error">${this.#errorMessage}</div>`;
      default:
        return this.#renderNotebookList();
    }
  }

  #renderNotebookList() {
    if (this.#notebooks.length === 0) {
      return html`<div class="empty-state">
        No notebooks found. Create a notebook in NotebookLM first.
      </div>`;
    }

    return html`
      <ul class="notebook-list">
        ${this.#notebooks.map(
          (notebook) => html`
            <li
              class="notebook-item"
              @click=${() => this.#handleSelectNotebook(notebook)}
            >
              <span class="notebook-emoji">${notebook.emoji || "📓"}</span>
              <span class="notebook-name">
                ${notebook.displayName || notebook.name}
              </span>
            </li>
          `
        )}
      </ul>
    `;
  }
}
