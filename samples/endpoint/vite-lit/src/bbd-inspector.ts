/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SettingsData } from "./types";
import "./bbd-settings";
import "./bbd-run";

@customElement("bbd-inspector")
export class Debugger extends LitElement {
  @property()
  settings: SettingsData | null = null;

  render() {
    return html`<h1>Breadboard API Endpoint Inspector</h1>
      <bbd-settings
        @bbdloadsettings=${this.#onLoadSettings.bind(this)}
      ></bbd-settings>
      <bbd-run .settings=${this.settings}></bbd-run>`;
  }

  #onLoadSettings(event: CustomEvent) {
    this.settings = event.detail;
  }

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-inspector": Debugger;
  }
}
