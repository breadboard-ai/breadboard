/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";

export { BeesConfirmDialog };

/**
 * A beautiful, reusable confirmation modal overlay wrapping the native HTML5 `<dialog>` element.
 * Inherits and uses native browser focus trapping, Esc-dismiss, and backdrop styling.
 *
 * @fires confirm - Dispatched when the user clicks the primary confirm action.
 * @fires cancel - Dispatched when the dialog is closed/canceled without confirming.
 */
@customElement("bees-confirm-dialog")
class BeesConfirmDialog extends LitElement {
  @property({ type: Boolean })
  accessor open = false;

  @property({ type: String })
  accessor title = "Confirm Action";

  @property({ type: String })
  accessor message = "Are you sure you want to proceed?";

  @property({ type: String })
  accessor confirmLabel = "Confirm";

  @property({ type: String })
  accessor cancelLabel = "Cancel";

  @query("dialog")
  accessor dialogEl!: HTMLDialogElement;

  static styles = css`
    :host {
      display: contents;
    }

    dialog {
      border: none;
      background: #141822;
      color: #e2e8f0;
      border-radius: 12px;
      padding: 0;
      max-width: 440px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      font-family: inherit;
      border: 1px solid #1e293b;
      outline: none;
    }

    /* Native dialog backdrop styling */
    dialog::backdrop {
      background: rgba(9, 11, 15, 0.75);
      backdrop-filter: blur(8px);
      opacity: 0;
      transition: opacity 0.25s ease;
    }

    dialog[open]::backdrop {
      opacity: 1;
    }

    /* Scale/fade up animation on appearance */
    dialog[open] {
      animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes scaleUp {
      from {
        transform: scale(0.96);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    .dialog-card {
      display: flex;
      flex-direction: column;
      padding: 24px;
      gap: 16px;
    }

    .dialog-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #f8fafc;
      margin: 0;
    }

    .dialog-message {
      font-size: 0.85rem;
      line-height: 1.5;
      color: #94a3b8;
      margin: 0;
      white-space: pre-wrap;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }

    button {
      font-family: inherit;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }

    button.btn-cancel {
      background: #1e293b;
      color: #94a3b8;
      border-color: #334155;
    }

    button.btn-cancel:hover {
      background: #253347;
      color: #cbd5e1;
      border-color: #475569;
    }

    button.btn-confirm {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }

    button.btn-confirm:hover {
      opacity: 0.95;
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
    }

    button:active {
      transform: scale(0.96);
    }
  `;

  protected updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has("open") && this.dialogEl) {
      if (this.open) {
        if (!this.dialogEl.open) {
          this.dialogEl.showModal();
        }
      } else {
        if (this.dialogEl.open) {
          this.dialogEl.close();
        }
      }
    }
  }

  render() {
    return html`
      <dialog
        @click=${this.handleDialogClick}
        @close=${this.handleDialogClose}
      >
        <div class="dialog-card">
          <h3 class="dialog-title">${this.title}</h3>
          <p class="dialog-message">${this.message}</p>
          <div class="dialog-actions">
            <button
              class="btn-cancel"
              @click=${this.handleCancel}
            >
              ${this.cancelLabel}
            </button>
            <button
              class="btn-confirm"
              @click=${this.handleConfirm}
            >
              ${this.confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    `;
  }

  private handleDialogClick(e: MouseEvent) {
    // Click outside card (on Native Backdrop) closes dialogue.
    // Since dialog takes full page bounds, clicking dialog edge is clicking backdrop.
    const rect = this.dialogEl.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      this.handleCancel();
    }
  }

  private handleDialogClose() {
    // Native escape key or close() triggers native close event
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  private handleCancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  private handleConfirm() {
    this.dispatchEvent(new CustomEvent("confirm", { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bees-confirm-dialog": BeesConfirmDialog;
  }
}
