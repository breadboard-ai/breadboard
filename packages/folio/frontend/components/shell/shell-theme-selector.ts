/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { localized, msg } from "@lit/localize";

import { scaContext } from "../../sca/context/context.js";
import type { SCA } from "../../sca/sca.js";
import type { ThemeMode } from "../../sca/types.js";

@localized()
@customElement("o-shell-theme-selector")
export class ShellThemeSelector extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = css`
    :host {
      display: inline-block;
    }

    select {
      padding: var(--opal-grid-2) var(--opal-grid-4);
      border-radius: var(--opal-grid-6);
      background: var(--opal-color-surface-container);
      color: var(--opal-color-on-surface);
      border: 1px solid var(--opal-color-spinner-track);
      font-family: var(--opal-font-family);
      cursor: pointer;
    }

    select:focus {
      outline: 2px solid var(--opal-color-primary);
      outline-offset: 2px;
    }
  `;

  render() {
    const mode = this.sca.controller.theme.mode ?? "auto";

    return html`
      <select @change=${this.#onChange} .value=${mode}>
        <option value="auto">${msg("Auto")}</option>
        <option value="light">${msg("Light")}</option>
        <option value="dark">${msg("Dark")}</option>
      </select>
    `;
  }

  #onChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const mode = select.value as ThemeMode;
    this.sca?.actions.theme.setTheme(mode);
  }
}
