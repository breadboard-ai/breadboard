
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import '@material/web/checkbox/checkbox.js';
import type { MdCheckbox } from '@material/web/checkbox/checkbox.js';
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { ModalDismissedEvent } from "../../events/events.js";
import { EmailPrefsManager } from "../../utils/email-prefs-manager.js";

const Strings = BreadboardUI.Strings.forSection("Global");

@customElement("bb-warm-welcome-modal")
export class VEWarmWelcomeModal extends LitElement {
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

      label {
        display: block;
        padding: var(--bb-grid-size-2) 0;
      }

      md-checkbox {
        margin-right: var(--bb-grid-size);
      }

      .emphasis {
        font-weight: bold;
      }
    `,
  ];

  @property()
  accessor emailPrefsManager: EmailPrefsManager | null = null;

  @state()
  accessor emailUpdates = true;

  @state()
  accessor userResearch = true;

  #handleModalDismissed({ withSave }: ModalDismissedEvent) {
    // After first dismissal, we always save the prefs, but we only respect the
    // checkbox values if the user explicitly clicked save.
    this.emailPrefsManager?.updateEmailPrefs([
      ['OPAL_MARKETING_UPDATES', withSave && this.emailUpdates],
      ['OPAL_USER_RESEARCH', withSave && this.userResearch],
    ]);
  }

  render() {
    return html`<bb-modal
      modalTitle="${Strings.from('TEXT_WARM_WELCOME_TITLE')} &nbsp;👋"
      .showCloseButton=${false}
      .showSaveCancel=${true}
      saveButtonLabel=${Strings.from('COMMAND_CONFIRM')}
      @bbmodaldismissed=${this.#handleModalDismissed}
    >
      <p>${Strings.from('TEXT_WARM_WELCOME_INTRO')}</p>
      <p>
        <span class="emphasis">${Strings.from('TEXT_WARM_WELCOME_PRIVACY')}</span>
        ${Strings.from('TEXT_WARM_WELCOME_EMAIL_UPDATES')}
      </p>
      <label>
        <md-checkbox .checked=${this.emailUpdates}
          @change=${({ target }: { target: MdCheckbox }) => this.emailUpdates = target.checked}
        ></md-checkbox>
        ${Strings.from('LABEL_EMAIL_UPDATES')}
      </label>
      <label>
        <md-checkbox .checked=${this.userResearch}
          @change=${({ target }: { target: MdCheckbox }) => this.userResearch = target.checked}
        ></md-checkbox>
        ${Strings.from('LABEL_RESEARCH_STUDIES')}
      </label>
    </bb-modal>
    `;
  }

}
