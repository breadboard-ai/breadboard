/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Conversation } from "../llm/conversation.js";

@customElement("bbrt-driver-selector")
export class BBRTDriverSelector extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor conversation: Conversation | undefined = undefined;

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
    if (!this.conversation) {
      return nothing;
    }
    const info = this.conversation.driverInfo.get(
      this.conversation.activeDriverId
    );
    if (info === undefined) {
      return nothing;
    }
    const { name, icon } = info;
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
    if (!this.conversation) {
      return;
    }
    const availableKeys = [...this.conversation.driverInfo.keys()];
    if (availableKeys.length < 2) {
      return;
    }
    const indexOfActive = availableKeys.indexOf(
      this.conversation.activeDriverId
    );
    const nextIndex = (indexOfActive + 1) % availableKeys.length;
    const nextId = availableKeys[nextIndex]!;
    this.conversation.activeDriverId = nextId;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-driver-selector": BBRTDriverSelector;
  }
}
