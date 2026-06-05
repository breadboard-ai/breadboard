/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

import "../graph-editing-chat/chat-panel.js";
import "../graph-editing-chat/opie-avatar.js";

import * as Styles from "../../styles/styles.js";

export { ConversationColumn };

/**
 * Full-height conversation column for the Agent Workbench.
 *
 * Mounts `<bb-chat-panel mode="embedded">` as a permanently visible
 * conversation surface — no floating bubble, no toggle. The greeting
 * is shown automatically via the `resetGraphEditingAgent` trigger
 * (which fires on graph URL change and calls `showGreeting` when the
 * workbench is active).
 *
 * On first mount, if no entries exist yet, we show the greeting
 * immediately so the column is never empty.
 */
@customElement("bb-conversation-column")
class ConversationColumn extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    Styles.HostColorsBase.baseColors,
    Styles.HostIcons.icons,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: var(--light-dark-n-100);
        overflow: hidden;
        box-sizing: border-box;
      }

      * {
        box-sizing: border-box;
      }

      bb-chat-panel {
        flex: 1;
        min-height: 0;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();

    // Ensure the conversation opens with a greeting when the workbench
    // first mounts. The trigger handles subsequent graph changes.
    const agent = this.sca.controller.editor.graphEditingAgent;
    agent.showGreeting();
  }

  render() {
    return html`
      <bb-chat-panel
        mode="embedded"
        .showSelectionStrip=${false}
      ></bb-chat-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-conversation-column": ConversationColumn;
  }
}
