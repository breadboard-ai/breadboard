/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import '@material/web/tabs/primary-tab.js';
import '@material/web/tabs/tabs.js';
import '@material/web/checkbox/checkbox.js';
import { SignalWatcher } from "@lit-labs/signals";
import { ModalDismissedEvent } from "../../events/events.js";
import { ConsentRequestWithCallback, ConsentAction } from "@breadboard-ai/types";
import { CONSENT_RENDER_INFO } from "../../utils/consent-manager.js";

@customElement("bb-consent-request-modal")
export class VEConsentRequestModal extends SignalWatcher(LitElement) {

  @property()
  accessor consentRequest: ConsentRequestWithCallback | null = null;

  static styles = [
    type,
    colorsLight,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      bb-modal {
        &::part(container) {
          display: flex;
          flex-direction: column;
          width: 480px;
          max-width: 80%;
        }
      }
      .center {
        text-align: center;
      }
      
    `,
  ];

  #handleModalDismissed({ withSave, otherAction }: ModalDismissedEvent) {
    let action: ConsentAction;
    if (withSave) {
      action = ConsentAction.ALLOW;
    } else if (otherAction === "alwaysAllow") {
      action = ConsentAction.ALWAYS_ALLOW;
    } else if (otherAction === "alwaysDeny") {
      action = ConsentAction.ALWAYS_DENY;
    } else {
      action = ConsentAction.DENY;
    }
    this.consentRequest?.consentCallback(action);
  }

  render() {
    if (!this.consentRequest) {
      return nothing;
    }

    const { type } = this.consentRequest.request;
    const renderInfo = CONSENT_RENDER_INFO[type];

    return html`<bb-modal
      modalTitle=${renderInfo.name}
      .showCloseButton=${true}
      .showSaveCancel=${true}
      .otherActions=${[
      { id: "alwaysDeny", label: "Never Allow" },
      { id: "alwaysAllow", label: "Always Allow" },
      ]}
      saveButtonLabel="Allow"
      cancelButtonLabel="Deny"
      @bbmodaldismissed=${this.#handleModalDismissed}
    >
      ${renderInfo.description(this.consentRequest.request as any)}
    </bb-modal>`;
  }
}
