/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { UserNote, NoteLocation } from "../types.js";
import { icons } from "../../../../src/ui/styles/icons.js";

export { NotesContainer };

@customElement("ui-notes-container")
class NotesContainer extends LitElement {
  @property()
  accessor location!: NoteLocation;

  @property()
  accessor notes: UserNote[] = [];

  @state()
  accessor #isEditing = false;

  @state()
  accessor #newNoteText = "";

  static styles = [
    icons,
    css`
      :host {
        display: block;
        margin-top: var(--bb-grid-size-2);
        font-family: var(--font-family);
      }

      .note-list {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-2);
        margin-bottom: var(--bb-grid-size-2);
      }

      .note-item {
        background: var(--light-dark-n-98);
        border: 1px solid var(--border-color);
        border-radius: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        font-size: 13px;
        position: relative;
        color: var(--light-dark-n-10);

        .note-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--light-dark-n-50);
          margin-bottom: var(--bb-grid-size);
        }

        .delete-btn {
          background: none;
          border: none;
          color: var(--light-dark-e-40);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;

          &:hover {
            color: var(--light-dark-e-20);
          }

          & .g-icon {
            font-size: 14px;
          }
        }
      }

      .add-note-section {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-2);
      }

      textarea {
        width: 100%;
        border-radius: var(--bb-grid-size-2);
        border: 1px solid var(--border-color);
        background: var(--light-dark-n-100);
        color: var(--light-dark-n-0);
        padding: var(--bb-grid-size-2);
        resize: vertical;
        font-family: var(--font-family);
        font-size: 13px;

        &:focus {
          outline: none;
          border-color: var(--primary);
        }
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--bb-grid-size-2);

        button {
          padding: var(--bb-grid-size) var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size);
          font-size: 12px;
          cursor: pointer;
          border: none;
          font-weight: 500;
        }

        .save-btn {
          background: var(--primary);
          color: var(--text-color);
        }

        .cancel-btn {
          background: var(--light-dark-n-90);
          color: var(--light-dark-n-10);
        }

        .add-btn {
          background: none;
          border: 1px dashed var(--border-color);
          color: var(--primary);
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size);
          width: 100%;
          justify-content: center;
          padding: var(--bb-grid-size-2);

          &:hover {
            background: oklch(from var(--primary) l c h / 0.1);
            border-color: var(--primary);
          }

          & .g-icon {
            font-size: 16px;
          }
        }
      }
    `,
  ];

  #handleSave() {
    if (this.#newNoteText.trim()) {
      this.dispatchEvent(
        new CustomEvent("add-note", {
          detail: {
            location: this.location,
            text: this.#newNoteText.trim(),
          },
          bubbles: true,
          composed: true,
        })
      );
      this.#newNoteText = "";
      this.#isEditing = false;
    }
  }

  #handleDelete(noteId: string) {
    this.dispatchEvent(
      new CustomEvent("delete-note", {
        detail: {
          noteId,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="note-list">
        ${this.notes.map(
          (note) => html`
            <div class="note-item">
              <div class="note-header">
                <span>${new Date(note.timestamp).toLocaleString()}</span>
                <button
                  class="delete-btn"
                  @click=${() => this.#handleDelete(note.id)}
                  title="Delete Note"
                >
                  <span class="g-icon filled round">delete</span>
                </button>
              </div>
              <div class="note-text">${note.text}</div>
            </div>
          `
        )}
      </div>

      ${this.#isEditing
        ? html`
            <div class="add-note-section">
              <textarea
                placeholder="Add a note..."
                .value=${this.#newNoteText}
                @input=${(e: Event) =>
                  (this.#newNoteText = (e.target as HTMLTextAreaElement).value)}
                rows="3"
              ></textarea>
              <div class="actions">
                <button class="cancel-btn" @click=${() => (this.#isEditing = false)}>
                  Cancel
                </button>
                <button class="save-btn" @click=${this.#handleSave}>Save Note</button>
              </div>
            </div>
          `
        : html`
            <div class="actions">
              <button class="add-btn" @click=${() => (this.#isEditing = true)}>
                <span class="g-icon filled round">add</span>
                Add Note
              </button>
            </div>
          `}
    `;
  }
}
