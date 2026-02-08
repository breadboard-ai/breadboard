/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref } from "lit/directives/ref.js";
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
import { icons } from "../../styles/icons.js";
import "../shell/modal.js";
import "../notebooklm-viewer/notebooklm-viewer.js";
import "../shared/expanding-search-button.js";
import { ExpandingSearchButton } from "../shared/expanding-search-button.js";

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
  static styles = [
    icons,
    css`
      :host {
        display: block;
      }

      bb-modal {
        &::part(container) {
          width: 780px;
          height: 600px;
          max-height: 80%;
          max-width: 80%;
          display: flex;
          flex-direction: column;
        }
        & > :not([slot="header-actions"]) {
          flex-grow: 1;
          min-height: 0;
        }
      }

      .notebook-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-2);
        overflow-y: auto;
        grid-auto-rows: min-content;
      }

      .notebook-item {
        cursor: pointer;
        border-radius: var(--bb-grid-size-3);
        overflow: hidden;
        border: 2px solid transparent;
        transition: border-color 0.15s ease;
      }

      .notebook-item.selected {
        border-color: light-dark(var(--n-0, #000), var(--n-100, #fff));
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
        min-width: 400px;
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
        min-width: 400px;
      }

      .search-container {
        display: flex;
        align-items: center;
        margin-right: var(--bb-grid-size-2);
      }
    `,
  ];

  @property({ type: Boolean })
  accessor open = false;

  @property()
  accessor value: NotebookPickedValue[] = [];

  @state()
  accessor #pickerState: PickerState = "idle";

  @state()
  accessor #notebooks: Notebook[] = [];

  @state()
  accessor #errorMessage = "";

  @state()
  accessor #selectedNotebooks: Set<string> = new Set();

  @state()
  accessor #searchQuery = "";

  @consume({ context: scaContext })
  accessor sca!: SCA;

  #searchRef = createRef<ExpandingSearchButton>();

  /** Opens the picker dialog and fetches notebooks. */
  triggerFlow() {
    this.open = true;
    this.#selectedNotebooks = new Set();
    this.#searchQuery = "";
    this.#searchRef.value?.collapse();
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
    this.#selectedNotebooks = new Set();
    this.#searchQuery = "";
    this.#searchRef.value?.collapse();
    this.dispatchEvent(new InputCancelEvent());
  }

  #handleConfirm() {
    if (this.#selectedNotebooks.size === 0) {
      return;
    }
    // Convert selected notebooks to NotebookPickedValue array
    const values: NotebookPickedValue[] = this.#notebooks
      .filter((notebook) => this.#selectedNotebooks.has(notebook.name))
      .map((notebook) => {
        const id = notebook.name.replace("notebooks/", "");
        return {
          id,
          name: notebook.name,
          preview: notebook.displayName || id,
          emoji: notebook.emoji,
        };
      });

    this.value = values;
    this.open = false;
    this.#selectedNotebooks = new Set();
    this.dispatchEvent(new InputChangeEvent(values));
  }

  #handleToggleNotebook(notebook: Notebook) {
    const newSelected = new Set(this.#selectedNotebooks);
    if (newSelected.has(notebook.name)) {
      newSelected.delete(notebook.name);
    } else {
      newSelected.add(notebook.name);
    }
    this.#selectedNotebooks = newSelected;
  }

  #handleSearchInput(evt: Event) {
    const target = evt.target as ExpandingSearchButton;
    this.#searchQuery = target.value;
  }

  get #filteredNotebooks(): Notebook[] {
    if (!this.#searchQuery.trim()) {
      return this.#notebooks;
    }
    const query = this.#searchQuery.toLowerCase().trim();
    return this.#notebooks.filter((notebook) =>
      (notebook.displayName || "").toLowerCase().includes(query)
    );
  }

  override render() {
    if (!this.open) {
      return nothing;
    }

    return html`
      <bb-modal
        modalTitle="Select Notebooks"
        .showCloseButton=${true}
        .showSaveCancel=${true}
        .saveButtonLabel=${"Add"}
        .saveButtonDisabled=${this.#selectedNotebooks.size === 0}
        @bbmodaldismissed=${(evt: ModalDismissedEvent) => {
          if (evt.withSave) {
            this.#handleConfirm();
          } else {
            this.#handleClose();
          }
        }}
      >
        <div slot="header-actions" class="search-container">
          <bb-expanding-search-button
            ${ref(this.#searchRef)}
            placeholder="Search notebooks..."
            .value=${this.#searchQuery}
            @input=${this.#handleSearchInput}
          ></bb-expanding-search-button>
        </div>
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
    const notebooks = this.#filteredNotebooks;

    if (this.#notebooks.length === 0) {
      return html`<div class="empty-state">
        No notebooks found. Create a notebook in NotebookLM first.
      </div>`;
    }

    if (notebooks.length === 0) {
      return html`<div class="empty-state">
        No notebooks match your search.
      </div>`;
    }

    return html`
      <div class="notebook-grid">
        ${notebooks.map(
          (notebook) => html`
            <div
              class=${classMap({
                "notebook-item": true,
                selected: this.#selectedNotebooks.has(notebook.name),
              })}
              @click=${() => this.#handleToggleNotebook(notebook)}
            >
              <bb-notebooklm-viewer
                .notebook=${notebook}
              ></bb-notebooklm-viewer>
            </div>
          `
        )}
      </div>
    `;
  }
}
