/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { ModalDismissedEvent } from "../../events/events.js";

@customElement("bb-global-edit-confirmation-modal")
export class VEGlobalEditConfirmationModal extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      pointer-events: none;
    }

    bb-modal {
      pointer-events: auto;
    }
  `;

  render() {
    return html`<bb-modal
      modalTitle="This may edit your entire Opal. Confirm to continue"
      appearance="basic"
      .showCloseButton=${false}
      .showSaveCancel=${true}
      .saveButtonLabel=${"Confirm"}
      @bbmodaldismissed=${(evt: ModalDismissedEvent) => {
        this.dispatchEvent(
          new CustomEvent("bbglobaleditconfirmation", {
            detail: { confirmed: evt.withSave },
          })
        );
      }}
    >
    </bb-modal>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-global-edit-confirmation-modal": VEGlobalEditConfirmationModal;
  }
}
