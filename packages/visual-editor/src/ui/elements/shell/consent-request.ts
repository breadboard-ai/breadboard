/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import "@material/web/tabs/primary-tab.js";
import "@material/web/tabs/tabs.js";
import "@material/web/checkbox/checkbox.js";
import { SignalWatcher } from "@lit-labs/signals";
import { ModalDismissedEvent } from "../../events/events.js";
import { ConsentAction } from "@breadboard-ai/types";
import { CONSENT_RENDER_INFO } from "../../utils/consent-content-items.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { SCA } from "../../../sca/sca.js";
import { PendingConsent } from "../../../sca/types.js";

@customElement("bb-consent-request-modal")
export class VEConsentRequestModal extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor consentRequest: PendingConsent | null = null;

  static styles = [
    type,
    baseColors,
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

  #handleModalDismissed({ withSave }: ModalDismissedEvent) {
    let action: ConsentAction;
    if (withSave) {
      action = ConsentAction.ALWAYS_ALLOW;
    } else {
      action = ConsentAction.DENY;
    }

    if (!this.consentRequest) return;
    this.sca.controller.global.consent.updatePendingRequest(
      this.consentRequest,
      action
    );
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
      saveButtonLabel="Always Allow"
      @bbmodaldismissed=${this.#handleModalDismissed}
    >
      ${renderInfo.description(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.consentRequest.request as any
      )}
    </bb-modal>`;
  }
}
