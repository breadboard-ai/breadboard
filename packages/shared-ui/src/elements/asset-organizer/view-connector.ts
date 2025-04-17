/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html } from "@lit-labs/signals";
import { LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Organizer } from "../../state";
import { AssetPath } from "@breadboard-ai/types";
import { ok } from "@google-labs/breadboard";

@customElement("bb-view-connector")
export class ViewConnector extends LitElement {
  @property()
  accessor state: Organizer | null = null;

  @property()
  accessor path: AssetPath | null = null;

  render() {
    if (!this.state || !this.path) return nothing;

    const view = this.state?.graphAssets?.get(this.path)?.connector?.view;
    if (!view || !ok(view)) return nothing;

    return html`<bb-multi-output
      .schema=${view.schema}
      .outputs=${view.values}
    ></bb-multi-output>`;
  }
}
