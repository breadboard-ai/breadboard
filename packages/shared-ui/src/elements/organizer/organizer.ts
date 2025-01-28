/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { Organizer } from "../../state";
import { repeat } from "lit/directives/repeat.js";

@customElement("bb-organizer")
export class OrganizerView extends SignalWatcher(LitElement) {
  @property()
  accessor state: Organizer | null = null;

  render() {
    return repeat(this.state?.assets || [], ([path, asset]) => {
      return html`<div>${asset.metadata?.title || path}</div>`;
    });
  }
}
