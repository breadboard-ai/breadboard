/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { localized } from "@lit/localize";
import { provide } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { SCA } from "../../sca/sca.js";

import "./shell-header.js";
import "../pages/home.js";
import "../pages/agent.js";

@localized()
@customElement("o-shell-main")
export class ShellMain extends SignalWatcher(LitElement) {
  @provide({ context: scaContext })
  accessor sca;

  static styles = css`
    :host {
      display: block;
    }
    .content {
      padding: var(--opal-grid-6) var(--opal-grid-6) var(--opal-grid-6)
        var(--opal-grid-8);
    }
  `;

  constructor(opts: { sca: SCA }) {
    super();

    this.sca = opts.sca;
  }

  #renderShell() {
    return html`<o-shell-header></o-shell-header>`;
  }

  #renderHome() {
    return html`<o-page-home></o-page-home>`;
  }

  #renderAgent() {
    return html`<o-page-agent></o-page-agent>`;
  }

  #renderContent() {
    const url = this.sca.controller.router.parsedUrl;
    let content;
    switch (url.page) {
      case "home":
        content = this.#renderHome();
        break;
      case "agent":
        content = this.#renderAgent();
        break;
    }
    return html`<div class="content">${content}</div>`;
  }

  render() {
    return [this.#renderShell(), this.#renderContent()];
  }
}
