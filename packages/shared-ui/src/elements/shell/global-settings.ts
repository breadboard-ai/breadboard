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

type TabId = 'general' | 'experimental' | 'integrations' | 'billing';

@customElement("bb-global-settings-modal")
export class VEGlobalSettingsModal extends LitElement {
  @property()
  accessor flags: Promise<Readonly<RuntimeFlags>> | null = null;

  @property()
  accessor showExperimentalComponents: boolean = false;

  @property()
  accessor project: Project | null = null;

  @property()
  accessor uiState: BreadboardUI.State.UI | null = null;

  @state()
  accessor activeTabId: TabId = 'general';

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
          width: 720px;
          height: 500px;
          max-height: 80%;
          max-width: 80%;
          padding: 0;
          display: flex;
          flex-direction: column;
        }
        &::part(header) {
          padding: var(--bb-grid-size-4) var(--bb-grid-size-6) 0  var(--bb-grid-size-6);
        }
      }
      
      md-tabs {
        --md-sys-color-surface: var(--n-100);
      }

      .container {
        padding: var(--bb-grid-size-4) var(--bb-grid-size-6);
        overflow: auto;
        scrollbar-width: none;
        flex: 1 0 0;
      }

      label {
        display: block;
        padding: var(--bb-grid-size-2) 0;
      }

      md-checkbox {
        margin-right: var(--bb-grid-size);
      }
    `,
  ];

  render() {
    const showIntegrations = this.uiState?.flags?.mcp;
    const showExperimental = this.showExperimentalComponents;
    // Note, it looks weird to only have one tab, and since the other two are conditional,
    // we remove the tabs altogether when there's only one. Once we have Billing or 
    // Integrations becomes unconditinoal, we can remove this test and always show the tabs.
    const showTabs = showIntegrations || showExperimental;
    return html`<bb-modal
      modalTitle="Global Settings"
      .showCloseButton=${true}
      .showSaveCancel=${false}
    >
      ${showTabs ? html`
      <md-tabs @change=${({ target }: { target: MdTabs }) => this.activeTabId = target.activeTab?.dataset['tab'] as TabId}>
        <md-primary-tab data-tab="general">General</md-primary-tab>
        ${showIntegrations ? html`
          <md-primary-tab data-tab="integrations">Integrations</md-primary-tab>
        ` : nothing}
        ${showExperimental ? html`
          <md-primary-tab data-tab="experimental">Experimental Features</md-primary-tab>
        ` : nothing}
      </md-tabs>` : nothing}
      <div class="container">
      ${showTabs ? choose(this.activeTabId, [
      ['general', () => this.#renderGeneral()],
      ['integrations', () => this.#renderIntegrations()],
      ['experimental', () => this.#renderExperimental()],
    ]) : this.#renderGeneral()}
      </div>
    </bb-modal>`;
  }

  #renderGeneral() {
    return html`
    <label>
      <md-checkbox></md-checkbox>
      ${Strings.from('LABEL_EMAIL_UPDATES')}
    </label>
    <label>
      <md-checkbox></md-checkbox>
      ${Strings.from('LABEL_RESEARCH_STUDIES')}
    </label>
    `;
  }

  #renderIntegrations() {
    return html`<bb-mcp-servers-settings .project=${this.project}></bb-mcp-servers-settings>`;
  }

  #renderExperimental() {
    return html`<bb-runtime-flags .flags=${this.flags}></bb-runtime-flags>`;
  }
}
