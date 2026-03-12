// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared notes area — backed by a Yjs Y.Text.
 *
 * Uses `beforeinput` events to map each input action directly to the
 * corresponding Y.Text operation (insert, delete, replace). This is
 * much more robust than trying to diff the old/new textarea values,
 * because it handles Cmd+Z, Cmd+Shift+Z, paste, cut, autocorrect,
 * and multi-character selections correctly.
 *
 * Undo/redo is handled by Y.UndoManager, which understands CRDT
 * history and won't fight with remote changes.
 */

import { LitElement, html, css } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { doc } from "./sync.js";
import * as Y from "yjs";

const sharedText = doc.getText("notes");
const undoManager = new Y.UndoManager(sharedText);

@customElement("party-notes")
export class PartyNotes extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      background: var(--color-surface-alt, #22222e);
      border: 1px solid var(--color-border, #2e2e3e);
      border-radius: 6px;
      color: var(--color-text, #e8e8f0);
      font-family: var(--font, system-ui);
      font-size: 14px;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      transition: border-color 0.15s;
    }

    textarea:focus {
      border-color: var(--color-accent, #7c6cff);
      box-shadow: 0 0 0 2px var(--color-accent-glow, rgba(124, 108, 255, 0.2));
    }

    .hint {
      font-size: 11px;
      color: var(--color-text-muted, #8888a0);
      margin-top: 6px;
    }
  `;

  @state() private text = "";
  @query("textarea") private textarea!: HTMLTextAreaElement;

  /** Guard against feedback loops: ignore Y.Text events caused by our own input. */
  private isLocalUpdate = false;

  connectedCallback() {
    super.connectedCallback();
    sharedText.observe(this.#handleYjsChange);
    this.text = sharedText.toString();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    sharedText.unobserve(this.#handleYjsChange);
  }

  /**
   * Handle remote changes from Yjs.
   *
   * When another client types, we get a Y.Text event. We update the
   * textarea value while preserving the local cursor position.
   */
  #handleYjsChange = (_event: Y.YTextEvent) => {
    if (this.isLocalUpdate) return;

    const ta = this.textarea;
    if (!ta) {
      this.text = sharedText.toString();
      return;
    }

    // Preserve cursor position across remote updates.
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;
    this.text = sharedText.toString();

    // Re-apply after Lit renders.
    this.updateComplete.then(() => {
      ta.setSelectionRange(selStart, selEnd);
    });
  };

  /**
   * Intercept `beforeinput` to apply edits directly to Y.Text.
   *
   * The `InputEvent.inputType` tells us exactly what the user did,
   * and `getTargetRanges()` gives us the affected selection range.
   * This is far more robust than diffing old/new textarea values.
   */
  #handleBeforeInput = (e: InputEvent) => {
    const ta = this.textarea;
    if (!ta) return;

    const inputType = e.inputType;

    // Intercept undo/redo — use Y.UndoManager instead of native.
    if (inputType === "historyUndo") {
      e.preventDefault();
      undoManager.undo();
      return;
    }
    if (inputType === "historyRedo") {
      e.preventDefault();
      undoManager.redo();
      return;
    }

    // For all other input types, get the affected range.
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const hasSelection = start !== end;

    this.isLocalUpdate = true;

    // Handle delete-type inputs.
    if (inputType.startsWith("delete")) {
      e.preventDefault();
      if (hasSelection) {
        sharedText.delete(start, end - start);
        this.#syncAndSetCursor(start);
      } else if (inputType === "deleteContentBackward") {
        // Backspace.
        if (start > 0) {
          sharedText.delete(start - 1, 1);
          this.#syncAndSetCursor(start - 1);
        }
      } else if (inputType === "deleteContentForward") {
        // Delete key.
        if (start < sharedText.length) {
          sharedText.delete(start, 1);
          this.#syncAndSetCursor(start);
        }
      } else if (inputType === "deleteByCut") {
        // Cmd+X / Ctrl+X.
        if (hasSelection) {
          sharedText.delete(start, end - start);
          this.#syncAndSetCursor(start);
        }
      } else if (
        inputType === "deleteWordBackward" ||
        inputType === "deleteWordForward" ||
        inputType === "deleteSoftLineBackward" ||
        inputType === "deleteSoftLineForward" ||
        inputType === "deleteHardLineBackward" ||
        inputType === "deleteHardLineForward"
      ) {
        // Word/line delete — fall through to let native handle it,
        // then sync from the result.
        this.isLocalUpdate = false;
        return;
      }
      this.isLocalUpdate = false;
      return;
    }

    // Handle insert-type inputs.
    if (
      inputType === "insertText" ||
      inputType === "insertFromPaste" ||
      inputType === "insertFromDrop" ||
      inputType === "insertReplacementText" ||
      inputType === "insertLineBreak" ||
      inputType === "insertParagraph"
    ) {
      e.preventDefault();
      const data =
        inputType === "insertLineBreak" || inputType === "insertParagraph"
          ? "\n"
          : e.data ?? e.dataTransfer?.getData("text/plain") ?? "";

      if (!data) {
        this.isLocalUpdate = false;
        return;
      }

      // Delete selection first, then insert.
      if (hasSelection) {
        sharedText.delete(start, end - start);
      }
      sharedText.insert(start, data);
      this.#syncAndSetCursor(start + data.length);
      this.isLocalUpdate = false;
      return;
    }

    // Unknown input type — let native behavior handle it, then
    // fall back to sync from the DOM in the `input` event handler.
    this.isLocalUpdate = false;
  };

  /**
   * Fallback for input types we didn't handle in `beforeinput`.
   *
   * For complex operations like word-delete, we let the browser
   * handle the DOM change, then diff the result against Y.Text.
   */
  #handleInput = () => {
    if (this.isLocalUpdate) return;

    const ta = this.textarea;
    if (!ta) return;

    const newValue = ta.value;
    const oldValue = sharedText.toString();
    if (newValue === oldValue) return;

    this.isLocalUpdate = true;

    // Full diff as a fallback. Find the changed region.
    let start = 0;
    while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
      start++;
    }
    let endOld = oldValue.length;
    let endNew = newValue.length;
    while (
      endOld > start &&
      endNew > start &&
      oldValue[endOld - 1] === newValue[endNew - 1]
    ) {
      endOld--;
      endNew--;
    }

    doc.transact(() => {
      if (endOld > start) {
        sharedText.delete(start, endOld - start);
      }
      if (endNew > start) {
        sharedText.insert(start, newValue.slice(start, endNew));
      }
    });

    this.text = sharedText.toString();
    this.isLocalUpdate = false;
  };

  /**
   * Sync Y.Text → textarea and restore cursor.
   */
  #syncAndSetCursor(cursor: number) {
    this.text = sharedText.toString();
    this.updateComplete.then(() => {
      this.textarea?.setSelectionRange(cursor, cursor);
    });
  }

  render() {
    return html`
      <h2>Shared Notes</h2>
      <textarea
        .value=${this.text}
        @beforeinput=${this.#handleBeforeInput}
        @input=${this.#handleInput}
        placeholder="Type here — everyone sees it live…"
      ></textarea>
      <div class="hint">
        Changes sync instantly across all connected collaborators
      </div>
    `;
  }
}
