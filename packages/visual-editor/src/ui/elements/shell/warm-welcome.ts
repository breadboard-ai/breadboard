/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import "@material/web/checkbox/checkbox.js";
import type { MdCheckbox } from "@material/web/checkbox/checkbox.js";
import * as BreadboardUI from "../../../ui/index.js";
import { ModalDismissedEvent } from "../../events/events.js";
import { EmailPrefsManager } from "../../utils/email-prefs-manager.js";

const Strings = BreadboardUI.Strings.forSection("Global");

@customElement("bb-warm-welcome-modal")
export class VEWarmWelcomeModal extends LitElement {
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
          width: 720px;
          max-width: 80%;
        }

      label {
        display: flex;
        padding: var(--bb-grid-size-2) 0;
        gap: var(--bb-grid-size);
      }

      md-checkbox {
        --md-focus-ring-color: transparent;
        margin-right: var(--bb-grid-size);
        flex-shrink: 0;
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
      ["OPAL_MARKETING_UPDATES", withSave && this.emailUpdates],
      ["OPAL_USER_RESEARCH", withSave && this.userResearch],
    ]);
  }

  render() {
    return html`<bb-modal
      modalTitle="${Strings.from("TEXT_WARM_WELCOME_TITLE")} &nbsp;👋"
      .showCloseButton=${false}
      .showSaveCancel=${true}
      saveButtonLabel=${Strings.from("COMMAND_CONFIRM")}
      @bbmodaldismissed=${this.#handleModalDismissed}
    >
      <p class="md-body-large">
        ${Strings.from("TEXT_WARM_WELCOME_INTRO")}
        <span class="emphasis"
          >${Strings.from("TEXT_WARM_WELCOME_PRIVACY")}</span
        >
        ${Strings.from("TEXT_WARM_WELCOME_EMAIL_UPDATES")}
      </p>
      <label class="md-body-large">
        <md-checkbox
          .checked=${this.emailUpdates}
          @change=${({ target }: { target: MdCheckbox }) =>
            (this.emailUpdates = target.checked)}
        ></md-checkbox>
        ${Strings.from("LABEL_EMAIL_UPDATES")}
      </label>
      <label class="md-body-large">
        <md-checkbox
          .checked=${this.userResearch}
          @change=${({ target }: { target: MdCheckbox }) =>
            (this.userResearch = target.checked)}
        ></md-checkbox>
        ${Strings.from("LABEL_EMAIL_RESEARCH")}
      </label>
    </bb-modal> `;
  }
}
