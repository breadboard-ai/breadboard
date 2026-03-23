/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

/**
 * @constructor
 * @extends {LitElement}
 */
const SignalWatcherBase = SignalWatcher(LitElement);

@customElement("opal-main")
/** @extends {LitElement} */
class OpalMain extends SignalWatcherBase {
  static override styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      padding: 2rem;
    }
  `;

  @signal accessor time = new Date().toLocaleTimeString();

  override connectedCallback() {
    super.connectedCallback();
    setInterval(() => {
      this.time = new Date().toLocaleTimeString();
    }, 1000);
  }

  override render() {
    return html`<h1>Hello, Signals! The time is ${this.time}</h1>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "opal-main": OpalMain;
  }
}
