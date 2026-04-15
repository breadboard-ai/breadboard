/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { localized, msg } from "@lit/localize";
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { scaContext } from "../../sca/context/context.js";
import { SCA } from "../../sca/sca.js";
import { sharedStyles } from "../../ui/shared-styles.js";

import "../primitives/primitive-card.js";

@localized()
@customElement("o-page-home")
export class PageHome extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ];

  render() {
    return html`<o-primitive-card>
      <h1 slot="header">${msg("Home")}</h1>
      <div slot="content">
        <p>${msg("Hello, World!")}</p>
      </div>
    </o-primitive-card>`;
  }
}
