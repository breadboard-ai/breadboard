/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
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
        gap: var(--bb-grid-size-3);
        margin: var(--bb-grid-size-2) var(--bb-grid-size-2) var(--bb-grid-size-3) var(--bb-grid-size);
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
      }

      .note-item {
        background: #fef08a; /* Bright yellow postit */
        border: 1px solid #facc15;
        border-bottom-right-radius: 12px 4px;
        border-radius: 4px;
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        font-size: 13px;
        position: relative;
        color: #1e293b; /* Readable dark slate */
        box-shadow: 
          1px 3px 6px oklch(0 0 0 / 0.08),
          0 1px 2px oklch(0 0 0 / 0.04);
        transform: rotate(-0.6deg);
        transition: transform 0.2s cubic-bezier(0.3, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.3, 0, 0.2, 1);

        &:nth-child(even) {
          transform: rotate(0.6deg);
          border-bottom-left-radius: 12px 4px;
          border-bottom-right-radius: 4px;
        }

        &:hover {
          transform: translateY(-2px) scale(1.005) rotate(0deg);
          box-shadow: 
            3px 6px 12px oklch(0 0 0 / 0.1),
            0 2px 4px oklch(0 0 0 / 0.05);
        }

        .note-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #64748b;
          margin-bottom: var(--bb-grid-size);
          border-bottom: 1px dashed oklch(from #facc15 l c h / 0.5);
          padding-bottom: var(--bb-grid-size);
          font-weight: 500;
        }

        .note-text {
          line-height: 1.5;
          white-space: pre-wrap;
          font-weight: 400;
        }

        .delete-btn {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          opacity: 0.6;
          transition: opacity 0.2s ease-in-out, transform 0.1s ease-in-out;

          &:hover {
            opacity: 1;
            color: #dc2626;
            transform: scale(1.05);
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
        background: #fef9c3; /* Lighter composed note */
        border: 1px dashed #facc15;
        padding: var(--bb-grid-size-2);
        border-radius: 6px;
        box-shadow: inset 0 1px 2px oklch(0 0 0 / 0.05);
      }

      textarea {
        width: 100%;
        border-radius: 4px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #1e293b;
        padding: var(--bb-grid-size-2);
        resize: vertical;
        font-family: var(--font-family);
        font-size: 13px;
        box-shadow: inset 0 1px 2px oklch(0 0 0 / 0.04);
        transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

        &:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: inset 0 1px 2px oklch(0 0 0 / 0.04), 0 0 0 3px oklch(from #f59e0b l c h / 0.2);
        }
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--bb-grid-size-2);

        button {
          padding: var(--bb-grid-size) var(--bb-grid-size-3);
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          border: none;
          font-weight: 600;
          transition: transform 0.1s ease, background 0.2s ease;
        }

        .save-btn {
          background: #f59e0b;
          color: #ffffff;
          box-shadow: 0 1px 2px oklch(0 0 0 / 0.05);

          &:hover {
            background: #d97706;
          }
          &:active {
            transform: scale(0.98);
          }
        }

        .cancel-btn {
          background: #e2e8f0;
          color: #475569;

          &:hover {
            background: #cbd5e1;
          }
          &:active {
            transform: scale(0.98);
          }
        }
      }

      .reaction-actions {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-3);
        width: 100%;
        margin-top: var(--bb-grid-size-2);
      }

      .reaction-btn {
        background: var(--light-dark-n-95, transparent);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--bb-grid-size-3);
        color: var(--light-dark-n-30, #555);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 38px;
        width: 38px;
        flex-shrink: 0;
        transition: 
          background 0.2s cubic-bezier(0, 0, 0.3, 1),
          color 0.2s cubic-bezier(0, 0, 0.3, 1),
          border-color 0.2s cubic-bezier(0, 0, 0.3, 1),
          transform 0.1s cubic-bezier(0, 0, 0.3, 1);

        &:hover {
          color: var(--primary);
          border-color: var(--primary);
          background: oklch(from var(--primary) l c h / 0.1);
        }

        &.good:hover {
          color: #34a853;
          border-color: #34a853;
          background: oklch(from #34a853 l c h / 0.15);
        }

        &.good.active {
          color: #ffffff !important;
          background: #34a853 !important;
          border-color: #34a853 !important;
        }

        &.bad:hover {
          color: #ea4335;
          border-color: #ea4335;
          background: oklch(from #ea4335 l c h / 0.15);
        }

        &.bad.active {
          color: #ffffff !important;
          background: #ea4335 !important;
          border-color: #ea4335 !important;
        }

        &:active {
          transform: scale(0.95);
        }

        & .g-icon {
          font-size: 18px;
        }
      }

      .add-btn {
        background: var(--light-dark-n-95, transparent);
        border: 1px dashed var(--border-color, #e0e0e0);
        border-radius: var(--bb-grid-size-3);
        color: var(--primary);
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        flex-grow: 1;
        justify-content: center;
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        height: 38px;
        font-weight: 500;
        cursor: pointer;
        transition: 
          background 0.2s cubic-bezier(0, 0, 0.3, 1),
          color 0.2s cubic-bezier(0, 0, 0.3, 1),
          border-color 0.2s cubic-bezier(0, 0, 0.3, 1),
          transform 0.1s cubic-bezier(0, 0, 0.3, 1);

        &:hover {
          background: oklch(from var(--primary) l c h / 0.1);
          border-color: var(--primary);
        }

        &:active {
          transform: scale(0.98);
        }

        & .g-icon {
          font-size: 16px;
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
    const notes = Array.isArray(this.notes) ? this.notes : [];
    const nonReactionNotes = notes.filter((n) => !n.reaction);
    const hasGood = notes.some((n) => n?.reaction === "good");
    const hasBad = notes.some((n) => n?.reaction === "bad");

    return html`
      <div class="note-list">
        ${nonReactionNotes.map(
          (note) => html`
            <div class="note-item">
              <div class="note-header">
                <span>${note.timestamp ? new Date(note.timestamp).toLocaleString() : ""}</span>
                <button
                  class="delete-btn"
                  @click=${() => this.#handleDelete(note.id)}
                  title="Delete Note"
                >
                  <span class="g-icon round">delete</span>
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
            <div class="reaction-actions">
              <button class="add-btn" @click=${() => (this.#isEditing = true)}>
                <span class="g-icon round">add</span>
                Add Note
              </button>
              <button
                class=${classMap({ "reaction-btn": true, "good": true, "active": hasGood })}
                @click=${() => this.#handleReaction("good")}
                title="Mark as Good"
              >
                <span class=${classMap({ "g-icon": true, "round": true, "filled": hasGood })}>thumb_up</span>
              </button>
              <button
                class=${classMap({ "reaction-btn": true, "bad": true, "active": hasBad })}
                @click=${() => this.#handleReaction("bad")}
                title="Mark as Bad"
              >
                <span class=${classMap({ "g-icon": true, "round": true, "filled": hasBad })}>thumb_down</span>
              </button>
            </div>
          `}
    `;
  }

  #handleReaction(reaction: "good" | "bad") {
    const existingNote = Array.isArray(this.notes) 
      ? this.notes.find((n) => n.reaction === reaction)
      : null;

    if (existingNote) {
      this.dispatchEvent(
        new CustomEvent("delete-note", {
          detail: {
            noteId: existingNote.id,
          },
          bubbles: true,
          composed: true,
        })
      );
      return;
    }

    this.dispatchEvent(
      new CustomEvent("add-note", {
        detail: {
          location: this.location,
          text: reaction === "good" ? "Good" : "Bad",
          reaction,
        },
        bubbles: true,
        composed: true,
      })
    );
  }
}

