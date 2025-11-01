/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { Project } from "../../state";
import { RuntimeFlags } from "@breadboard-ai/types";
import '@material/web/tabs/primary-tab.js';
import '@material/web/tabs/tabs.js';
import '@material/web/checkbox/checkbox.js';
import type { MdCheckbox } from '@material/web/checkbox/checkbox.js';
import type { MdTabs } from '@material/web/tabs/tabs.js';
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { EmailPrefsManager } from "../../utils/email-prefs-manager.js";
import { SignalWatcher } from "@lit-labs/signals";
import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";

const Strings = BreadboardUI.Strings.forSection("Global");

enum TabId {
  GENERAL = "GENERAL",
  EXPERIMENTAL = "EXPERIMENTAL",
  INTEGRATIONS = "INTEGRATIONS",
}

function getTabEnabledMap(
  uiState: BreadboardUI.State.UI | undefined,
  showExperimentalComponents: boolean
): Record<TabId, boolean> {
  return {
    [TabId.GENERAL]: Boolean(CLIENT_DEPLOYMENT_CONFIG.ENABLE_EMAIL_OPT_IN),
    [TabId.INTEGRATIONS]: Boolean(uiState?.flags?.mcp),
    [TabId.EXPERIMENTAL]: showExperimentalComponents,
  }
}

function countEnabledTabs(enabledTabs: Record<TabId, boolean>) {
  return Object.values(enabledTabs).filter((enabled) => enabled).length;
}

// Only show tabs if there are two or more, since it looks weird to have a single centered tab
function shouldShowTabs(enabledTabs: Record<TabId, boolean>) {
  return countEnabledTabs(enabledTabs) > 1;
}

/**
 * Returns whether there are any enabled global settings
 */
export function hasEnabledGlobalSettings(
  uiState: BreadboardUI.State.UI | undefined,
  showExperimentalComponents: boolean
) {
  return countEnabledTabs(getTabEnabledMap(
    uiState,
    showExperimentalComponents)
  ) > 0;
}

@customElement("bb-global-settings-modal")
export class VEGlobalSettingsModal extends SignalWatcher(LitElement) {
  @property()
  accessor flags: Promise<Readonly<RuntimeFlags>> | null = null;

  @property()
  accessor showExperimentalComponents: boolean = false;

  @property()
  accessor project: Project | null = null;

  @property()
  accessor uiState: BreadboardUI.State.UI | undefined = undefined;

  @property()
  accessor emailPrefsManager: EmailPrefsManager | null = null;

  @state()
  accessor enabledTabs: Record<TabId, boolean> | undefined = undefined;

  @state()
  accessor activeTabId: TabId = TabId.GENERAL;

  connectedCallback() {
    super.connectedCallback();
    if (CLIENT_DEPLOYMENT_CONFIG.ENABLE_EMAIL_OPT_IN) {
      this.emailPrefsManager?.refreshPrefs();
    }
  }

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
        display: flex;
        padding: var(--bb-grid-size-2) 0;
        gap: var(--bb-grid-size);
      }

      md-checkbox {
        --md-focus-ring-color: transparent;
        margin-right: var(--bb-grid-size);
        flex-shrink: 0;
      }
    `,
  ];

  getTabRenderInfo(): Record<TabId, { name: string, template: () => unknown }> {
    return {
      [TabId.GENERAL]: {
        name: 'General',
        template: () => html`
          ${CLIENT_DEPLOYMENT_CONFIG.ENABLE_EMAIL_OPT_IN ?
            (this.emailPrefsManager?.prefsValid ?
              html`<label>
              <md-checkbox .checked=${this.emailPrefsManager?.emailPrefs.get('OPAL_MARKETING_UPDATES') ?? false}
                @change=${({ target }: { target: MdCheckbox }) =>
                  this.emailPrefsManager?.updateEmailPrefs([['OPAL_MARKETING_UPDATES', target.checked]])}
              ></md-checkbox>
              ${Strings.from('LABEL_EMAIL_UPDATES')}
            </label>
            <label>
              <md-checkbox .checked=${this.emailPrefsManager?.emailPrefs.get('OPAL_USER_RESEARCH') ?? false}
                @change=${({ target }: { target: MdCheckbox }) =>
                  this.emailPrefsManager?.updateEmailPrefs([['OPAL_USER_RESEARCH', target.checked]])}
              ></md-checkbox>
              ${Strings.from('LABEL_RESEARCH_STUDIES')}
            </label>
            `: html`Loading email preferences...`)
            : nothing}`
      },
      [TabId.INTEGRATIONS]: {
        name: "Integrations",
        template: () => html`
          <bb-mcp-servers-settings .project=${this.project}>
          </bb-mcp-servers-settings>`
      },
      [TabId.EXPERIMENTAL]: {
        name: "Experimental Features",
        template: () => html`
          <bb-runtime-flags .flags=${this.flags}>
          </bb-runtime-flags>`
      },
    };
  }


  willUpdate() {
    this.enabledTabs = getTabEnabledMap(this.uiState, this.showExperimentalComponents);
    // Changing settings might cause the currently selected tab to become disabled;
    // In this case, change the active tab to the first enabled one
    const enabledTabs = this.enabledTabs;
    if (!enabledTabs) {
      return;
    }
    if (!this.enabledTabs[this.activeTabId]) {
      this.activeTabId = (Object.keys(enabledTabs) as TabId[]).find(id => enabledTabs[id]) ?? TabId.GENERAL;
    }
  }

  render() {
    const enabledTabs = this.enabledTabs;
    if (!enabledTabs) {
      return;
    }
    const tabInfo = this.getTabRenderInfo();
    const showTabs = shouldShowTabs(enabledTabs);
    return html`<bb-modal
      modalTitle="Global Settings"
      .showCloseButton=${true}
      .showSaveCancel=${false}
    >
      ${showTabs ? html`
      <md-tabs @change=${({ target }: { target: MdTabs }) => this.activeTabId = target.activeTab?.dataset['tab'] as TabId}>
        ${(Object.keys(enabledTabs) as TabId[]).filter(id => enabledTabs[id]).map((id) => html`
          <md-primary-tab data-tab="${id}" ?active=${id === this.activeTabId}>${tabInfo[id].name}</md-primary-tab>
        `)}
      </md-tabs>` : nothing}
      <div class="container">
        ${tabInfo[this.activeTabId].template()}
      </div>
    </bb-modal>`;
  }
}
