/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

import "../primitives/primitive-avatar.js";
import { consume } from "@lit/context";
import { scaContext } from "../../sca/context/context.js";
import { SCA } from "../../sca/sca.js";
import { map } from "lit/directives/map.js";

@customElement("o-shell-sidebar")
export class ShellSidebar extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: var(--opal-width-sidebar);
      padding: 0 var(--opal-grid-4);
      box-sizing: border-box;
      color: var(--opal-color-on-surface);
      height: 100%;
      align-items: center;
      justify-content: center;
      gap: var(--opal-grid-3);
    }
  `;

  #onClick(agentId: string) {
    this.sca.controller.router.go({ agentId, page: "agent" });
  }

  #renderAvatars() {
    const configs = this.sca.controller.agent.agents;

    const url = this.sca.controller.router.parsedUrl;
    const currentAgentId = url.page === "agent" ? url.agentId : undefined;

    return map(configs, (config) => {
      return html`<o-primitive-avatar
        .bgColor=${config.bgColor}
        .fgColor=${config.fgColor}
        ?selected=${config.id === currentAgentId}
        .count=${config.count}
        @click=${() => this.#onClick(config.id)}
      ></o-primitive-avatar>`;
    });
  }

  render() {
    return this.#renderAvatars();
  }
}
