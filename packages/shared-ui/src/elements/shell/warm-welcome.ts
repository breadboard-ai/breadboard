
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { StateEvent } from "../../events/events";
import { Project } from "../../state";
import { RuntimeFlags } from "@breadboard-ai/types";
import { repeat } from "lit/directives/repeat.js";
import { until } from "lit/directives/until.js";
import { choose } from "lit/directives/choose.js";
import '@material/web/tabs/primary-tab.js';
import '@material/web/tabs/tabs.js';
import '@material/web/checkbox/checkbox.js';
import type { MdTabs } from '@material/web/tabs/tabs.js';
import * as BreadboardUI from "@breadboard-ai/shared-ui";

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

  render() {
    return html`<bb-modal
      modalTitle="${Strings.from('TEXT_WARM_WELCOME_TITLE')} &nbsp;👋"
      .showCloseButton=${false}
      .showSaveCancel=${true}
      saveButtonLabel=${Strings.from('COMMAND_CONFIRM')}
    >
      <p>${Strings.from('TEXT_WARM_WELCOME_INTRO')}</p>
      <p>
        <span class="emphasis">${Strings.from('TEXT_WARM_WELCOME_PRIVACY')}</span>
        ${Strings.from('TEXT_WARM_WELCOME_EMAIL_UPDATES')}
      </p>
      <label>
        <md-checkbox></md-checkbox>
        ${Strings.from('LABEL_EMAIL_UPDATES')}
      </label>
      <label>
        <md-checkbox></md-checkbox>
        ${Strings.from('LABEL_RESEARCH_STUDIES')}
      </label>
    </bb-modal>
    `;
  }

}
