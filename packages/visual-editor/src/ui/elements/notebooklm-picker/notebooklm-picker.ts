/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref } from "lit/directives/ref.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA, type Notebook } from "../../../sca/sca.js";
import { ModalDismissedEvent } from "../../events/events.js";
import { icons } from "../../styles/icons.js";
import "../shell/modal.js";
import "../notebooklm-viewer/notebooklm-viewer.js";
import "../shared/expanding-search-button.js";
import { ExpandingSearchButton } from "../shared/expanding-search-button.js";
import { SignalWatcher } from "@lit-labs/signals";

// Re-export the type for backward compatibility
export type { NotebookPickedValue } from "../../../sca/controller/subcontrollers/editor/notebooklm-picker-controller.js";

/**
 * Singleton NotebookLM picker component.
 *
 * Renders the picker modal when `notebookLmPicker.pickerOpen` is true.
 * Open via `sca.actions.notebookLmPicker.open(callback)`.
 */
@customElement("bb-notebooklm-picker")
export class NotebookLmPicker extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    css`
      :host {
        display: contents;
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
        max-width: 400px;
        margin: 0 auto;
        word-wrap: break-word;

        & a {
          color: inherit;
          text-decoration: underline;
        }
      }

      .search-container {
        display: flex;
        align-items: center;
        margin-right: var(--bb-grid-size-2);
      }
    `,
  ];

  @consume({ context: scaContext })
  accessor sca!: SCA;

  #searchRef = createRef<ExpandingSearchButton>();

  #handleClose() {
    this.sca.controller.editor.notebookLmPicker.reset();
    this.#searchRef.value?.collapse();
  }

  #handleConfirm() {
    const nlm = this.sca.controller.editor.notebookLmPicker;
    if (nlm.selectedNotebooks.size === 0) {
      return;
    }
    // This invokes the onConfirm callback and resets
    this.sca.actions.notebookLmPicker.confirmSelection();
    this.#searchRef.value?.collapse();
  }

  #handleToggleNotebook(notebook: Notebook) {
    this.sca.controller.editor.notebookLmPicker.toggleSelection(notebook.name);
  }

  #handleSearchInput(evt: Event) {
    const target = evt.target as ExpandingSearchButton;
    this.sca.controller.editor.notebookLmPicker.searchQuery = target.value;
  }

  override render() {
    const nlm = this.sca.controller.editor.notebookLmPicker;
    if (!nlm.pickerOpen) {
      return nothing;
    }

    return html`
      <bb-modal
        modalTitle="Select Notebooks"
        .showCloseButton=${true}
        .showSaveCancel=${true}
        .saveButtonLabel=${"Add"}
        .saveButtonDisabled=${nlm.selectedNotebooks.size === 0}
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
            .value=${nlm.searchQuery}
            @input=${this.#handleSearchInput}
          ></bb-expanding-search-button>
        </div>
        ${this.#renderContent()}
      </bb-modal>
    `;
  }

  #renderContent() {
    const nlm = this.sca.controller.editor.notebookLmPicker;
    switch (nlm.pickerState) {
      case "loading":
        return html`<div class="loading">Loading notebooks...</div>`;
      case "error":
        return html`<div class="error">${nlm.errorMessage}</div>`;
      default:
        return this.#renderNotebookList();
    }
  }

  #renderNotebookList() {
    const nlm = this.sca.controller.editor.notebookLmPicker;
    const notebooks = nlm.filteredNotebooks;

    if (nlm.notebooks.length === 0) {
      return html`<div class="empty-state">
        No notebooks found. Create a notebook in
        <a href="https://notebooklm.google.com" target="_blank" rel="noopener"
          >NotebookLM</a
        >
        first.
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
                selected: nlm.selectedNotebooks.has(notebook.name),
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
