/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Signal } from "signal-polyfill";
import type { BBRTDriver } from "../drivers/driver-interface.js";

@customElement("bbrt-driver-selector")
export class BBRTDriverSelector extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  available?: BBRTDriver[];

  @property({ attribute: false })
  active?: Signal.State<BBRTDriver>;

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      margin-right: 16px;
    }
    button {
      cursor: pointer;
      background: inherit;
      border: none;
      margin: 0;
      padding: 0;
    }
    img {
      width: 24px;
      max-height: 24px;
    }
  `;

  override render() {
    if (this.active === undefined || this.available === undefined) {
      return nothing;
    }
    const { name, icon } = this.active.get();
    return html`
      <button
        @click=${this.#cycle}
        title="Using ${name}. Click to cycle models."
      >
        <img alt="Using model ${name}" src=${icon} />
      </button>
    `;
  }

  #cycle() {
    if (this.active === undefined || this.available === undefined) {
      return;
    }
    const indexOfActive = this.available.indexOf(this.active.get());
    const nextIndex = (indexOfActive + 1) % this.available.length;
    this.active.set(this.available[nextIndex]!);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-driver-selector": BBRTDriverSelector;
  }
}
