/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, SignalWatcher } from "@lit-labs/signals";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Organizer } from "../../state";
import { AssetPath } from "@breadboard-ai/types";

@customElement("bb-edit-connector")
export class EditConnector extends SignalWatcher(LitElement) {
  @property()
  accessor state: Organizer | null = null;

  @property()
  accessor path: AssetPath | null = null;

  render() {
    return html`edit connector`;
  }
}
