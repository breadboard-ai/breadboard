/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

@customElement("bb-global-edit-confirmation-modal")
export class VEGlobalEditConfirmationModal extends SignalWatcher(LitElement) {
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

  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    return html`<bb-modal
      modalTitle="This may edit your entire Opal. Confirm to continue"
      appearance="basic"
      .showCloseButton=${false}
      .showSaveCancel=${true}
      .saveButtonLabel=${"Confirm"}
    >
    </bb-modal>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-global-edit-confirmation-modal": VEGlobalEditConfirmationModal;
  }
}
