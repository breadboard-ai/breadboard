/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";

import "@material/web/tabs/primary-tab.js";
import "@material/web/tabs/tabs.js";
import "@material/web/checkbox/checkbox.js";
import type { MdCheckbox } from "@material/web/checkbox/checkbox.js";
import type { MdTabs } from "@material/web/tabs/tabs.js";
import * as BreadboardUI from "../../../ui/index.js";
import type { UI } from "../../types/state-types.js";
import { EmailPrefsManager } from "../../utils/email-prefs-manager.js";
import { SignalWatcher } from "@lit-labs/signals";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../../ui/config/client-deployment-configuration.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

const Strings = BreadboardUI.Strings.forSection("Global");

enum TabId {
  GENERAL = "GENERAL",
  EXPERIMENTAL = "EXPERIMENTAL",
  INTEGRATIONS = "INTEGRATIONS",
}

function getTabEnabledMap(sca: SCA | undefined): Record<TabId, boolean> {
  return {
    [TabId.GENERAL]: Boolean(CLIENT_DEPLOYMENT_CONFIG.ENABLE_EMAIL_OPT_IN),
    [TabId.INTEGRATIONS]: Boolean(sca?.controller?.global?.flags?.mcp),
    [TabId.EXPERIMENTAL]: Boolean(
      sca?.controller?.global.main.experimentalComponents
    ),
  };
}

function countEnabledTabs(enabledTabs: Record<TabId, boolean>) {
  return Object.values(enabledTabs).filter((enabled) => enabled).length;
}

// Only show tabs if there are two or more, since it looks weird to have a single centered tab
function shouldShowTabs(enabledTabs: Record<TabId, boolean>) {
  return countEnabledTabs(enabledTabs) > 1;
}

@customElement("bb-global-settings-modal")
export class VEGlobalSettingsModal extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor uiState: UI | undefined = undefined;

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
          width: 720px;
          height: 500px;
          max-height: 80%;
          max-width: 80%;
          padding: 0;
          display: flex;
          flex-direction: column;
        }
        &::part(header) {
          padding: var(--bb-grid-size-4) var(--bb-grid-size-6) 0
            var(--bb-grid-size-6);
        }
      }

      md-tabs {
        --md-primary-tab-active-pressed-state-layer-color: light-dark(
          var(--p-50),
          var(--p-80)
        );

        --md-primary-tab-active-hover-state-layer-color: light-dark(
          var(--p-50),
          var(--p-80)
        );

        --md-primary-tab-active-indicator-color: light-dark(
          var(--p-50),
          var(--p-70)
        );

        --md-primary-tab-active-focus-label-text-color: light-dark(
          var(--p-50),
          var(--p-70)
        );

        --md-primary-tab-active-label-text-color: light-dark(
          var(--p-50),
          var(--p-70)
        );

        --md-primary-tab-hover-label-text-color: light-dark(
          var(--n-0),
          var(--n-90)
        );

        --md-primary-tab-label-text-color: light-dark(var(--n-20), var(--n-80));
        --md-sys-color-surface: light-dark(var(--n-100), var(--n-15));
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
        &.disabled {
          font-style: italic;
          opacity: 0.8;
        }
      }

      md-checkbox {
        --md-focus-ring-color: transparent;
        margin-right: var(--bb-grid-size);
        flex-shrink: 0;
      }
    `,
  ];

  getTabRenderInfo(): Record<TabId, { name: string; template: () => unknown }> {
    return {
      [TabId.GENERAL]: {
        name: Strings.from("LABEL_SETTINGS_GENERAL"),
        template: () =>
          html` ${CLIENT_DEPLOYMENT_CONFIG.ENABLE_EMAIL_OPT_IN
            ? html`<label
                  class=${classMap({
                    disabled: !this.emailPrefsManager?.prefsValid,
                  })}
                >
                  <md-checkbox
                    .checked=${this.emailPrefsManager?.emailPrefs.get(
                      "OPAL_MARKETING_UPDATES"
                    ) ?? false}
                    .disabled=${!this.emailPrefsManager?.prefsValid}
                    @change=${({ target }: { target: MdCheckbox }) =>
                      this.emailPrefsManager?.updateEmailPrefs([
                        ["OPAL_MARKETING_UPDATES", target.checked],
                      ])}
                  ></md-checkbox>
                  ${Strings.from("LABEL_EMAIL_UPDATES")}
                </label>
                <label
                  class=${classMap({
                    disabled: !this.emailPrefsManager?.prefsValid,
                  })}
                >
                  <md-checkbox
                    .checked=${this.emailPrefsManager?.emailPrefs.get(
                      "OPAL_USER_RESEARCH"
                    ) ?? false}
                    .disabled=${!this.emailPrefsManager?.prefsValid}
                    @change=${({ target }: { target: MdCheckbox }) =>
                      this.emailPrefsManager?.updateEmailPrefs([
                        ["OPAL_USER_RESEARCH", target.checked],
                      ])}
                  ></md-checkbox>
                  ${Strings.from("LABEL_EMAIL_RESEARCH")}
                </label>`
            : nothing}`,
      },
      [TabId.INTEGRATIONS]: {
        name: Strings.from("LABEL_SETTINGS_INTEGRATIONS"),
        template: () =>
          html` <bb-mcp-servers-settings> </bb-mcp-servers-settings>`,
      },
      [TabId.EXPERIMENTAL]: {
        name: Strings.from("LABEL_SETTINGS_EXPERIMENTAL"),
        template: () =>
          html` <bb-runtime-flags
            .flags=${this.sca.controller.global.flags.flags()}
          >
          </bb-runtime-flags>`,
      },
    };
  }

  willUpdate() {
    this.enabledTabs = getTabEnabledMap(this.sca);
    // Changing settings might cause the currently selected tab to become disabled;
    // In this case, change the active tab to the first enabled one
    const enabledTabs = this.enabledTabs;
    if (!enabledTabs) {
      return;
    }
    if (!this.enabledTabs[this.activeTabId]) {
      this.activeTabId =
        (Object.keys(enabledTabs) as TabId[]).find((id) => enabledTabs[id]) ??
        TabId.GENERAL;
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
      ${showTabs
        ? html` <md-tabs
            @change=${({ target }: { target: MdTabs }) =>
              (this.activeTabId = target.activeTab?.dataset["tab"] as TabId)}
          >
            ${(Object.keys(enabledTabs) as TabId[])
              .filter((id) => enabledTabs[id])
              .map(
                (id) => html`
                  <md-primary-tab
                    data-tab="${id}"
                    ?active=${id === this.activeTabId}
                    >${tabInfo[id].name}</md-primary-tab
                  >
                `
              )}
          </md-tabs>`
        : nothing}
      <div class="container">${tabInfo[this.activeTabId].template()}</div>
    </bb-modal>`;
  }
}
