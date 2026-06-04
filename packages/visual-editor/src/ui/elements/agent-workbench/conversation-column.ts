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
        border: 1px solid var(--light-dark-n-90);
        border-radius: var(--bb-grid-size-3);
        overflow: hidden;
        box-sizing: border-box;
      }

      * {
        box-sizing: border-box;
      }

      header {
        display: flex;
        align-items: center;
        height: 48px;
        padding: 0 var(--bb-grid-size-4);
        background: var(--light-dark-n-100);
        border-bottom: 1px solid var(--light-dark-n-90);
        flex-shrink: 0;

        & h2 {
          margin: 0;
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: var(--light-dark-n-20);
        }

        & .g-icon {
          margin-right: var(--bb-grid-size-2);
          font-size: 20px;
          color: var(--light-dark-n-40);
        }
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
      <header>
        <span class="g-icon filled round">forum</span>
        <h2>Chat</h2>
      </header>
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
