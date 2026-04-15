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

@localized()
@customElement("o-page-agent")
export class PageAgent extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  #onClick() {
    this.sca.controller.router.go({ page: "home" });
  }

  render() {
    return [
      html`<h1>${msg("Agent")}</h1>`,
      html`<button @click=${() => this.#onClick()}>Home</button>`,
    ];
  }
}
