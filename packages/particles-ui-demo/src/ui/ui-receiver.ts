/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Receiver } from "../receiver";

import "./todo-list";

@customElement("ui-receiver")
export class UiReceiver extends SignalWatcher(LitElement) {
  @property()
  accessor receiver: Receiver | null = null;

  render() {
    return html`<todo-list
      .items=${this.receiver?.list.items}
      .channel=${this.receiver?.channel}
    ></todo-list>`;
  }
}
