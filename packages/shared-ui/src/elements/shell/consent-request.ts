/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import '@material/web/tabs/primary-tab.js';
import '@material/web/tabs/tabs.js';
import '@material/web/checkbox/checkbox.js';
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { SignalWatcher } from "@lit-labs/signals";
import { ModalDismissedEvent } from "../../events/events.js";
import { ConsentRequestWithCallback, ConsentRequest, ConsentType, ConsentAction } from "@breadboard-ai/types";
import { HTMLTemplateResult } from "lit";

const Strings = BreadboardUI.Strings.forSection("Global");

// Helper type to extract the specific ConsentRequest subtype based on the ConsentType
type ConsentRequestOfType<T extends ConsentType> = Extract<ConsentRequest, { type: T }>;

// Interface for the render info for a single ConsentType
interface ConsentRenderInfo<T extends ConsentType> {
  name: string;
  description: (request: ConsentRequestOfType<T>) => HTMLTemplateResult;
}

// The type for the main CONSENT_RENDER_INFO object
type ConsentRenderInfoMap = {
  [K in ConsentType]: ConsentRenderInfo<K>;
};

const CONSENT_RENDER_INFO: ConsentRenderInfoMap = {
  [ConsentType.POPUP]: {
    name: "Open popup?",
    description: (request) => html`
      <p>This Opal would like to open a popup to the following website:</p>
      <p>${request.scope}</p>
      <p>Only click allow if you recognize this website and trust the Opal.</p>
    `
  },
  [ConsentType.FETCH]: {
    name: "Allow network request?",
    description: (request) => html`
      <p>This Opal would like to make a network request to the following website:</p>
      <p>${request.scope}</p>
      <p>Only click allow if you recognize this website and trust the Opal.</p>
    `
  },
  [ConsentType.MCP]: {
    name: "Connect to MCP server?",
    description: (request) => html`
      <p>This Opal would like to connect to MCP server at ${request.scope.url} with scope ${request.scope.scope}</p>
      <p>Only click allow if you recognize this website and trust the Opal.</p>
    `
  }
};


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
        {id: "alwaysDeny", label: "Never Allow"},
        {id: "alwaysAllow", label: "Always Allow"},
      ]}
      saveButtonLabel="Allow"
      cancelButtonLabel="Deny"
      @bbmodaldismissed=${this.#handleModalDismissed}
    >
      ${renderInfo.description(this.consentRequest.request as any)}
    </bb-modal>`;
  }
}
