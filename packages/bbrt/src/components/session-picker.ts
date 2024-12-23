/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("bbrt-session-picker")
export class BBRTSesssionPicker extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
      padding: 24px;
      font-family: Helvetica, sans-serif;
    }
    ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    li {
      margin: 0.2em 0;
    }
    a {
      text-decoration: none;
      color: #6c80a0;
      font-size: 0.85em;
    }
    a:hover {
      color: #498fff;
    }
    :first-child {
      margin-top: 0;
    }
    img {
      height: 16px;
      max-width: 16px;
    }
    .active > a {
      color: #008dff;
    }
  `;

  override render() {
    return html`
      <button @click=${this.#clickNewSessionButton}>New Session</button>
    `;
  }

  #clickNewSessionButton(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.log("New session button clicked");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-session-picker": BBRTSesssionPicker;
  }
}
